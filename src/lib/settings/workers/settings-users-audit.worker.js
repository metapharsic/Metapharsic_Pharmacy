// ─────────────────────────────────────────────────────────────
// Multi-Threaded Settings & Users Audit Worker (Node.js Worker Thread)
// Offloads heavy CPU-bound configuration validation & user security checks:
// 1. System & Organization settings data integrity and GST statutory compliance
// 2. User account security, role assignments & branch distribution audit
// 3. Multi-branch configuration reconciliation
// ─────────────────────────────────────────────────────────────
const { parentPort } = require('worker_threads')

/**
 * Task 1: Audit Settings Integrity & Statutory Parameters
 */
function auditSettingsIntegrity(payload) {
  const { systemSettings, orgSettings, organization } = payload

  const issues = []
  let totalSettingsChecked = 0
  let validSettingsCount = 0

  // 1. Audit System Settings data types and values
  for (let i = 0; i < systemSettings.length; i++) {
    const s = systemSettings[i]
    totalSettingsChecked++
    let isValid = true

    if (s.dataType === 'boolean') {
      if (s.value !== 'true' && s.value !== 'false' && s.value !== '1' && s.value !== '0') {
        issues.push({
          category: s.category,
          key: s.key,
          type: 'INVALID_BOOLEAN',
          message: `Setting ${s.category}.${s.key} expected boolean string, got "${s.value}"`,
        })
        isValid = false
      }
    } else if (s.dataType === 'number') {
      const num = Number(s.value)
      if (isNaN(num)) {
        issues.push({
          category: s.category,
          key: s.key,
          type: 'INVALID_NUMBER',
          message: `Setting ${s.category}.${s.key} expected number, got "${s.value}"`,
        })
        isValid = false
      } else {
        if (s.key === 'max_discount_percent' && (num < 0 || num > 100)) {
          issues.push({
            category: s.category,
            key: s.key,
            type: 'OUT_OF_RANGE',
            message: `Max discount percent must be between 0 and 100, got ${num}`,
          })
          isValid = false
        }
        if (s.key === 'low_stock_threshold' && num < 0) {
          issues.push({
            category: s.category,
            key: s.key,
            type: 'OUT_OF_RANGE',
            message: `Low stock threshold cannot be negative, got ${num}`,
          })
          isValid = false
        }
      }
    } else if (s.dataType === 'json') {
      try {
        JSON.parse(s.value)
      } catch (err) {
        issues.push({
          category: s.category,
          key: s.key,
          type: 'INVALID_JSON',
          message: `Setting ${s.category}.${s.key} failed JSON parsing: ${err.message}`,
        })
        isValid = false
      }
    }

    if (isValid) validSettingsCount++
  }

  // 2. Audit Organization statutory licenses & tax parameters
  let gstComplianceValid = false
  if (organization) {
    totalSettingsChecked += 4

    // GSTIN check
    const gstin = organization.gstin || ''
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    if (gstinRegex.test(gstin)) {
      validSettingsCount++
      gstComplianceValid = true

      // State code cross-check
      const stateCodeSetting = systemSettings.find(
        (s) => s.category === 'gst' && s.key === 'state_code'
      )
      if (stateCodeSetting && stateCodeSetting.value !== gstin.substring(0, 2)) {
        issues.push({
          category: 'gst',
          key: 'state_code',
          type: 'STATE_CODE_MISMATCH',
          message: `GST state code setting (${stateCodeSetting.value}) does not match GSTIN prefix (${gstin.substring(0, 2)})`,
        })
      }
    } else {
      issues.push({
        category: 'organization',
        key: 'gstin',
        type: 'INVALID_GSTIN',
        message: `Organization GSTIN "${gstin}" does not match Indian statutory format`,
      })
    }

    // Drug License check
    if (organization.dlNumber && organization.dlNumber.trim().length > 3) {
      validSettingsCount++
    } else {
      issues.push({
        category: 'organization',
        key: 'dlNumber',
        type: 'MISSING_DRUG_LICENSE',
        message: 'Organization is missing a valid Drug License Number (Form 20/21)',
      })
    }

    // PAN check
    if (organization.pan && organization.pan.length === 10) {
      validSettingsCount++
    } else if (organization.gstin && organization.gstin.length >= 12) {
      // Auto-derivable
      validSettingsCount++
    }

    // Legal Name check
    if (organization.legalName && organization.legalName.trim().length > 2) {
      validSettingsCount++
    }
  }

  const status = issues.length === 0 ? 'HEALTHY' : issues.some((i) => i.type.includes('INVALID')) ? 'WARNING' : 'HEALTHY'

  return {
    totalSettingsChecked,
    validSettingsCount,
    issues,
    gstComplianceValid,
    status,
  }
}

/**
 * Task 2: Audit User Security, Roles & Branch Assignments
 */
function auditUserSecurityCompliance(payload) {
  const { users, roles, branches } = payload

  let activeUsers = 0
  let inactiveUsers = 0
  let activeOwnersCount = 0
  let orphanedUsersCount = 0

  const roleDistribution = {}
  const branchDistribution = { global: 0 }
  const securityWarnings = []

  // Initialize distribution buckets
  for (let i = 0; i < roles.length; i++) {
    roleDistribution[roles[i].name] = 0
  }
  for (let i = 0; i < branches.length; i++) {
    branchDistribution[branches[i].id] = 0
  }

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    if (u.isActive) {
      activeUsers++
    } else {
      inactiveUsers++
    }

    const userRoleNames = (u.userRoles || []).map((ur) => ur.role?.name || ur.roleId)
    if (userRoleNames.length === 0) {
      orphanedUsersCount++
      securityWarnings.push({
        userId: u.id,
        userName: u.name,
        type: 'ORPHANED_ACCOUNT',
        message: `User ${u.name} (${u.email}) has no assigned roles`,
      })
    }

    for (let j = 0; j < userRoleNames.length; j++) {
      const rName = userRoleNames[j]
      roleDistribution[rName] = (roleDistribution[rName] || 0) + 1
      if (rName === 'owner' && u.isActive) {
        activeOwnersCount++
      }
    }

    if (u.branchId) {
      branchDistribution[u.branchId] = (branchDistribution[u.branchId] || 0) + 1
    } else {
      branchDistribution.global = (branchDistribution.global || 0) + 1
    }
  }

  // Safety safeguard check
  if (activeOwnersCount === 0) {
    securityWarnings.push({
      type: 'NO_ACTIVE_OWNER',
      message: 'CRITICAL: No active Owner accounts found in system!',
    })
  }

  const securityStatus =
    activeOwnersCount === 0 ? 'VULNERABLE' : securityWarnings.length > 0 ? 'WARNING' : 'SECURE'

  return {
    totalUsers: users.length,
    activeUsers,
    inactiveUsers,
    activeOwnersCount,
    orphanedUsersCount,
    roleDistribution,
    branchDistribution,
    securityWarnings,
    securityStatus,
  }
}

/**
 * Task 3: Reconcile Branch & Organization Settings
 */
function reconcileBranchAndOrgSettings(payload) {
  const { branches, organization, orgSettings } = payload

  let headOfficeConfigured = false
  const prefixMap = {}
  const discrepancies = []

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]
    if (b.isHeadOffice) {
      if (headOfficeConfigured) {
        discrepancies.push({
          branchId: b.id,
          message: `Multiple head offices detected: ${b.name}`,
        })
      }
      headOfficeConfigured = true
    }

    const prefix = b.invoicePrefix || 'PC'
    if (prefixMap[prefix]) {
      discrepancies.push({
        branchId: b.id,
        message: `Duplicate invoice prefix "${prefix}" between ${b.name} and ${prefixMap[prefix]}`,
      })
    } else {
      prefixMap[prefix] = b.name
    }

    if (b.invoiceCounter < 1) {
      discrepancies.push({
        branchId: b.id,
        message: `Branch ${b.name} has invalid invoice counter: ${b.invoiceCounter}`,
      })
    }
  }

  if (!headOfficeConfigured && branches.length > 0) {
    discrepancies.push({
      message: 'No active branch is designated as Head Office',
    })
  }

  const reconciliationStatus = discrepancies.length === 0 ? 'SYNCHRONIZED' : 'DRIFT_DETECTED'

  return {
    totalBranches: branches.length,
    headOfficeConfigured,
    branchPrefixes: prefixMap,
    discrepancies,
    reconciliationStatus,
  }
}

// ─────────────────────────────────────────────────────────────
// Worker Thread Event Listener
// ─────────────────────────────────────────────────────────────
if (parentPort) {
  parentPort.on('message', ({ id, command, payload }) => {
    try {
      let result
      switch (command) {
        case 'AUDIT_SETTINGS_INTEGRITY':
          result = auditSettingsIntegrity(payload)
          break
        case 'AUDIT_USER_SECURITY_COMPLIANCE':
          result = auditUserSecurityCompliance(payload)
          break
        case 'RECONCILE_BRANCH_AND_ORG_SETTINGS':
          result = reconcileBranchAndOrgSettings(payload)
          break
        default:
          throw new Error(`Unknown settings audit worker command: ${command}`)
      }
      parentPort.postMessage({ id, success: true, data: result })
    } catch (err) {
      parentPort.postMessage({
        id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}

// Export functions for direct synchronous fallback
module.exports = {
  auditSettingsIntegrity,
  auditUserSecurityCompliance,
  reconcileBranchAndOrgSettings,
}

