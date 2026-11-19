import prisma from '@/lib/db/prisma'

export interface SidebarModuleDefinition {
  key: string
  label: string
  category: string
  description: string
  iconName: string
  requiredPermission?: string
  defaultForRoles: string[]
}

export const ALL_SIDEBAR_MODULES: SidebarModuleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard Overview',
    category: 'Core',
    description: 'Executive KPI metrics, revenue summary, low stock alerts, and daily velocity.',
    iconName: 'LayoutDashboard',
    defaultForRoles: ['owner', 'manager', 'super_admin'],
  },
  {
    key: 'pos',
    label: 'POS & Dispensary Billing (F2)',
    category: 'Dispensary',
    description: 'Keyboard-first dispensing counter, strip cut matrix, barcode scanner, and bill holds.',
    iconName: 'ShoppingCart',
    requiredPermission: 'sales:create',
    defaultForRoles: ['cashier', 'pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'products',
    label: 'Products & HSN Directory',
    category: 'Dispensary',
    description: 'Medicine master catalog, DPCO pricing, categories, and HSN statutory codes.',
    iconName: 'Pill',
    requiredPermission: 'products:read',
    defaultForRoles: ['pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'inventory',
    label: 'Inventory & Batch Stock',
    category: 'Dispensary',
    description: 'Real-time stock ledger, physical audits, FEFO batch tracking, and stock adjustments.',
    iconName: 'BarChart3',
    requiredPermission: 'inventory:read',
    defaultForRoles: ['pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'purchases',
    label: 'Purchases & OCR Bill Ingestion',
    category: 'Dispensary',
    description: 'Supplier invoices, agency orders, automated bill camera OCR scanning, and GRN.',
    iconName: 'Truck',
    requiredPermission: 'purchases:read',
    defaultForRoles: ['manager', 'owner', 'super_admin'],
  },
  {
    key: 'sales',
    label: 'Sales History & Prescriptions',
    category: 'Dispensary',
    description: 'Customer ledgers, prescribing doctor masters, Rx approval, and historical bill reprints.',
    iconName: 'Receipt',
    requiredPermission: 'sales:read',
    defaultForRoles: ['pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'returns',
    label: 'Returns & Credit Notes',
    category: 'Dispensary',
    description: 'Customer returns, vendor debit notes, and inventory restoration.',
    iconName: 'RotateCcw',
    requiredPermission: 'returns:read',
    defaultForRoles: ['manager', 'owner', 'super_admin'],
  },
  {
    key: 'expiry',
    label: 'Batch Expiry Surveillance',
    category: 'Compliance',
    description: '30/60/90 days near-expiry alerts, expired stock quarantine, and vendor returns.',
    iconName: 'AlertTriangle',
    requiredPermission: 'batches:read',
    defaultForRoles: ['pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'finance',
    label: 'Financials & Tally Sync',
    category: 'Finance',
    description: 'Double-entry ledgers, F6 receipt vouchers, GSTR-1/3B statutory reports, and Tally ERP XML sync.',
    iconName: 'BadgeDollarSign',
    requiredPermission: 'finance:read',
    defaultForRoles: ['manager', 'owner', 'super_admin'],
  },
  {
    key: 'reports',
    label: 'Compliance & Narcotics Registers',
    category: 'Compliance',
    description: 'Schedule H1 registers, doctor commission audits, and statutory dispensary logs.',
    iconName: 'ShieldAlert',
    requiredPermission: 'reports:sales',
    defaultForRoles: ['pharmacist', 'manager', 'owner', 'super_admin'],
  },
  {
    key: 'settings',
    label: 'Settings, Users & Roles',
    category: 'System',
    description: 'Branch masters, role permission matrix, user accounts, and security preferences.',
    iconName: 'Settings',
    requiredPermission: 'settings:read',
    defaultForRoles: ['owner', 'super_admin'],
  },
  {
    key: 'platform',
    label: 'Platform SuperAdmin Center',
    category: 'Platform',
    description: 'Live multi-tenant supervision, CPU/RAM telemetry, licensing, and geo-zone audit.',
    iconName: 'Shield',
    defaultForRoles: ['super_admin'],
  },
]

export const ROLE_PRESETS: Record<string, string[]> = {
  cashier: ['pos', 'sales', 'returns'],
  pharmacist: ['pos', 'products', 'inventory', 'sales', 'expiry', 'reports'],
  manager: ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'sales', 'returns', 'expiry', 'finance', 'reports'],
  owner: ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'sales', 'returns', 'expiry', 'finance', 'reports', 'settings'],
  super_admin: ALL_SIDEBAR_MODULES.map((m) => m.key),
}

/**
 * Retrieve assigned sidebar modules for a specific user.
 * 1. Checks specific user setting `user:<userId>`.
 * 2. Fallback to user's assigned role presets.
 */
export async function getUserSidebarModules(userId: string, roleNames: string[] = []): Promise<{
  modules: string[]
  isCustomAssigned: boolean
}> {
  // Check if super admin
  if (roleNames.includes('super_admin')) {
    return { modules: ALL_SIDEBAR_MODULES.map((m) => m.key), isCustomAssigned: false }
  }

  // 1. Check user-specific custom assignment in SystemSetting
  const userSetting = await prisma.systemSetting.findUnique({
    where: {
      category_key: {
        category: 'sidebar',
        key: `user:${userId}`,
      },
    },
  })

  if (userSetting && userSetting.value) {
    try {
      const parsed = JSON.parse(userSetting.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { modules: parsed, isCustomAssigned: true }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Fallback to roles
  const combined = new Set<string>()
  for (const role of roleNames) {
    const preset = ROLE_PRESETS[role.toLowerCase()]
    if (preset) {
      preset.forEach((m) => combined.add(m))
    }
  }

  if (combined.size > 0) {
    return { modules: Array.from(combined), isCustomAssigned: false }
  }

  // Default fallback for owner/admin
  return { modules: ROLE_PRESETS.owner, isCustomAssigned: false }
}

/**
 * Superadmin action: Save customized sidebar module assignments for a user
 */
export async function saveUserSidebarModules(userId: string, modules: string[], adminUserId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const jsonValue = JSON.stringify(modules)

  await prisma.systemSetting.upsert({
    where: {
      category_key: {
        category: 'sidebar',
        key: `user:${userId}`,
      },
    },
    update: {
      value: jsonValue,
      dataType: 'json',
      label: `Sidebar modules for ${user.email}`,
    },
    create: {
      category: 'sidebar',
      key: `user:${userId}`,
      value: jsonValue,
      dataType: 'json',
      label: `Sidebar modules for ${user.email}`,
    },
  })

  if (adminUserId) {
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'SIDEBAR_ASSIGNED',
        entity: 'User',
        entityId: userId,
        newData: {
          targetUser: user.email,
          assignedModules: modules,
        },
      },
    })
  }

  return { success: true, modules }
}

/**
 * Superadmin action: Reset user sidebar to their role's default preset
 */
export async function resetUserSidebarModules(userId: string) {
  await prisma.systemSetting.deleteMany({
    where: {
      category: 'sidebar',
      key: `user:${userId}`,
    },
  })
  return { success: true }
}
