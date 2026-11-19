/**
 * Metapharsic Rx — Sovereign Narcotic & Controlled Substances Service
 * Implements statutory controlled substance dispensing rules across 6 sovereign jurisdictions:
 * - Saudi Arabia (SFDA): سجل الأدوية المخدرة والمؤثرات العقلية (SFDA Controlled Drug Register)
 * - Oman (MoH): استمارة صرف الأدوية المراقبة (Oman MoH Controlled Medicines Log)
 * - Bahrain (NHRA): سجل المواد المخدرة والمؤثرات العقلية (NHRA Schedule I/II Register)
 * - Qatar (MoPH): سجل صرف الأدوية الخاضعة للرقابة (Qatar MoPH Narcotics Register)
 * - Maldives (MFDA): MFDA National Controlled Substances Register
 * - India (CDSCO / State FDA): Schedule H1 & Schedule X Register (Drugs & Cosmetics Rules Form 35)
 */

import { createHash } from 'crypto'
import { TerritoryCode, getTerritory } from '@/lib/territory/territory-config'

export type SovereignDrugClassification =
  | 'SFDA_CONTROLLED'
  | 'SFDA_PSYCHOTROPIC'
  | 'MOH_CONTROLLED_1'
  | 'MOH_CONTROLLED_2'
  | 'NHRA_SCHEDULE_I'
  | 'NHRA_SCHEDULE_II'
  | 'MOPH_NARCOTIC_A'
  | 'MOPH_NARCOTIC_B'
  | 'MFDA_CONTROLLED'
  | 'SCHEDULE_X'
  | 'SCHEDULE_H1'
  | 'SCHEDULE_H'
  | 'NON_CONTROLLED'

export interface NarcoticValidationInput {
  territoryCode: TerritoryCode
  drugClassification?: string | null
  productName: string
  quantity: number
  batchNumber?: string
  patient: {
    name: string
    nationalId?: string // Iqama/NID in KSA, Civil ID in Oman, CPR in Bahrain, QID in Qatar, Aadhaar in India
    phone?: string
    address?: string
  }
  prescriber: {
    name: string
    licenseNumber?: string // SCFHS in KSA, MoH in Oman, NHRA in Bahrain, MCI in India
    clinicName?: string
  }
  prescription: {
    prescriptionNumber: string
    issueDate?: string | Date
  }
}

export interface NarcoticValidationResult {
  isControlled: boolean
  allowed: boolean
  territoryCode: TerritoryCode
  sovereignRegisterNameEn: string
  sovereignRegisterNameAr: string
  regulatoryAuthorityEn: string
  regulatoryAuthorityAr: string
  classification: SovereignDrugClassification
  missingRequirements: string[]
  validationErrors: string[]
  auditChecksum?: string
}

export interface SovereignNarcoticEntry {
  id: string
  timestamp: string
  territoryCode: TerritoryCode
  registerName: string
  productName: string
  batchNumber: string
  quantity: number
  patientName: string
  patientId: string
  doctorName: string
  doctorLicense: string
  prescriptionNumber: string
  dispensedBy: string
  tamperProofHash: string
}

/**
 * Normalizes input drug schedule to recognized sovereign classification.
 */
export function resolveDrugClassification(
  scheduleOrCategory: string | null | undefined,
  territoryCode: TerritoryCode
): SovereignDrugClassification {
  if (!scheduleOrCategory) return 'NON_CONTROLLED'
  const upper = scheduleOrCategory.toUpperCase().trim()

  // Explicit non-controlled bypass
  if (upper === 'NON_CONTROLLED' || upper === 'NON-CONTROLLED' || upper === 'NONE' || upper === 'NORMAL' || upper === 'GENERAL') {
    return 'NON_CONTROLLED'
  }

  // India
  if (upper === 'X' || upper === 'SCHEDULE_X') return 'SCHEDULE_X'
  if (upper === 'H1' || upper === 'SCHEDULE_H1') return 'SCHEDULE_H1'
  if (upper === 'H' || upper === 'SCHEDULE_H') return 'SCHEDULE_H'

  // KSA SFDA
  if (upper.includes('SFDA_CONTROLLED') || upper.includes('NARCOTIC') || upper.includes('مخدر')) {
    return 'SFDA_CONTROLLED'
  }
  if (upper.includes('PSYCHOTROPIC') || upper.includes('مؤثر عقل') || upper.includes('CONTROLLED')) {
    return 'SFDA_PSYCHOTROPIC'
  }

  // Oman MoH
  if (upper.includes('MOH_CONTROLLED') || (territoryCode === 'OM' && upper.includes('CONTROLLED'))) {
    return 'MOH_CONTROLLED_1'
  }

  // Bahrain NHRA
  if (upper.includes('NHRA') || (territoryCode === 'BH' && upper.includes('CONTROLLED'))) {
    return 'NHRA_SCHEDULE_I'
  }

  // Qatar MoPH
  if (upper.includes('MOPH') || (territoryCode === 'QA' && upper.includes('NARCOTIC'))) {
    return 'MOPH_NARCOTIC_A'
  }

  // Maldives MFDA
  if (upper.includes('MFDA') || (territoryCode === 'MV' && upper.includes('CONTROLLED'))) {
    return 'MFDA_CONTROLLED'
  }

  return 'NON_CONTROLLED'
}

/**
 * Validates narcotic and controlled substance dispensing against sovereign laws.
 * Ensures dispensary counter does not dispense controlled narcotics without mandatory statutory identifiers.
 */
export function validateNarcoticDispensing(input: NarcoticValidationInput): NarcoticValidationResult {
  const territory = getTerritory(input.territoryCode)
  const classification = resolveDrugClassification(input.drugClassification, input.territoryCode)
  const isControlled = classification !== 'NON_CONTROLLED'

  const missingRequirements: string[] = []
  const validationErrors: string[] = []

  if (!isControlled) {
    return {
      isControlled: false,
      allowed: true,
      territoryCode: input.territoryCode,
      sovereignRegisterNameEn: 'Standard Dispensary Register',
      sovereignRegisterNameAr: 'سجل الصرف الاعتيادي',
      regulatoryAuthorityEn: territory.regulatory.authorityNameEn,
      regulatoryAuthorityAr: territory.regulatory.authorityNameAr,
      classification: 'NON_CONTROLLED',
      missingRequirements: [],
      validationErrors: [],
    }
  }

  // 1. Prescription Number is universally mandatory for any controlled drug
  if (!input.prescription.prescriptionNumber?.trim()) {
    missingRequirements.push('Prescription Serial Number is strictly mandatory for controlled substances.')
  }

  // 2. Prescribing Doctor Name is universally mandatory
  if (!input.prescriber.name?.trim()) {
    missingRequirements.push('Prescribing Doctor Full Legal Name is mandatory.')
  }

  // 3. Patient Name is mandatory
  if (!input.patient.name?.trim()) {
    missingRequirements.push('Patient Full Legal Name is mandatory.')
  }

  // Territory-Specific Sovereign Identity Mandates
  switch (input.territoryCode) {
    case 'SA': {
      // KSA SFDA: Requires 10-digit National ID (Saudi citizen starts with 1, Iqama resident starts with 2)
      const nationalId = input.patient.nationalId?.trim()
      if (!nationalId) {
        missingRequirements.push('Saudi National ID / Iqama (هوية وطنية / إقامة) is mandatory under SFDA Narcotic Regulations.')
      } else if (!/^[12]\d{9}$/.test(nationalId)) {
        validationErrors.push('Saudi National ID / Iqama must be exactly 10 digits starting with 1 (Citizen) or 2 (Resident).')
      }

      // Doctor SCFHS / SFDA License Number
      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Doctor Medical Council Registration (رقم ترخيص هيئة التخصصات الصحية SCFHS) is mandatory.')
      }
      break
    }

    case 'OM': {
      // Oman MoH: Requires 8-digit Civil ID (الرقم المدني العماني)
      const civilId = input.patient.nationalId?.trim()
      if (!civilId) {
        missingRequirements.push('Oman Civil ID (الرقم المدني العماني) is mandatory under MoH Controlled Medicines Form.')
      } else if (!/^\d{8,9}$/.test(civilId)) {
        validationErrors.push('Oman Civil ID must be 8 or 9 digits.')
      }

      // Doctor MoH License
      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Doctor MoH Practice License (ترخيص وزارة الصحة) is mandatory.')
      }
      break
    }

    case 'BH': {
      // Bahrain NHRA: Requires 9-digit CPR Number (الرقم السكاني)
      const cpr = input.patient.nationalId?.trim()
      if (!cpr) {
        missingRequirements.push('Bahrain CPR Number (الرقم السكاني CPR) is mandatory under NHRA Controlled Ledger.')
      } else if (!/^\d{9}$/.test(cpr)) {
        validationErrors.push('Bahrain CPR must be exactly 9 digits.')
      }

      // Doctor NHRA License
      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Doctor NHRA License Number is mandatory.')
      }
      break
    }

    case 'QA': {
      // Qatar MoPH: Requires 11-digit QID (الرقم الشخصي القطري)
      const qid = input.patient.nationalId?.trim()
      if (!qid) {
        missingRequirements.push('Qatar ID (QID / الرقم الشخصي) is mandatory under MoPH Narcotics Law.')
      } else if (!/^\d{11}$/.test(qid)) {
        validationErrors.push('Qatar QID must be exactly 11 digits.')
      }

      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Doctor MoPH License Number is mandatory.')
      }
      break
    }

    case 'MV': {
      // Maldives MFDA: Requires National ID (NID) or Work Permit Card
      const nid = input.patient.nationalId?.trim()
      if (!nid) {
        missingRequirements.push('Maldives National ID (NID) or Passport/Work Permit is mandatory under MFDA rules.')
      }
      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Maldives Medical Council Doctor Registration Number is mandatory.')
      }
      break
    }

    case 'IN':
    default: {
      // India Schedule H1 / Schedule X (Drugs & Cosmetics Rules Form 35)
      if (!input.patient.address?.trim()) {
        missingRequirements.push('Patient Residential Address is statutory under Indian Drugs & Cosmetics Rules (Schedule H1/X).')
      }
      if (!input.prescriber.licenseNumber?.trim()) {
        missingRequirements.push('Doctor MCI / State Medical Council Registration Number is mandatory.')
      }
      break
    }
  }

  const allowed = missingRequirements.length === 0 && validationErrors.length === 0

  // Calculate cryptographic SHA-256 tamper-proof checksum of the entry
  const canonicalData = [
    input.territoryCode,
    classification,
    input.productName,
    input.quantity,
    input.patient.name,
    input.patient.nationalId || '',
    input.prescriber.name,
    input.prescriber.licenseNumber || '',
    input.prescription.prescriptionNumber,
  ].join('|')

  const auditChecksum = createHash('sha256').update(canonicalData, 'utf-8').digest('hex')

  return {
    isControlled: true,
    allowed,
    territoryCode: input.territoryCode,
    sovereignRegisterNameEn: territory.regulatory.controlledDrugRegisterEn,
    sovereignRegisterNameAr: territory.regulatory.controlledDrugRegisterAr,
    regulatoryAuthorityEn: territory.regulatory.authorityNameEn,
    regulatoryAuthorityAr: territory.regulatory.authorityNameAr,
    classification,
    missingRequirements,
    validationErrors,
    auditChecksum,
  }
}

/**
 * Creates a formatted sovereign narcotic entry ready for persistent storage and audit reports.
 */
export function createSovereignNarcoticRecord({
  input,
  validation,
  dispenserName,
  batchNumber,
}: {
  input: NarcoticValidationInput
  validation: NarcoticValidationResult
  dispenserName: string
  batchNumber: string
}): SovereignNarcoticEntry {
  return {
    id: `narc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    territoryCode: input.territoryCode,
    registerName: validation.sovereignRegisterNameEn,
    productName: input.productName,
    batchNumber: batchNumber || 'LOT-STANDARD',
    quantity: input.quantity,
    patientName: input.patient.name,
    patientId: input.patient.nationalId || 'N/A',
    doctorName: input.prescriber.name,
    doctorLicense: input.prescriber.licenseNumber || 'N/A',
    prescriptionNumber: input.prescription.prescriptionNumber,
    dispensedBy: dispenserName,
    tamperProofHash: validation.auditChecksum || '',
  }
}
