// ─────────────────────────────────────────────────────────────
// METAPHARSIC LIFESCIENCES — LASA (Look-Alike / Sound-Alike) Safety Guard
// Prevents high-risk retail dispensing errors by cross-verifying
// visually extracted medicine strengths against catalog masters.
// ─────────────────────────────────────────────────────────────

export interface LasaRule {
  brandBase: string
  salt: string
  commonStrengths: string[]
  highRiskDiff: string
  guidance: string
}

export const COMMON_INDIAN_LASA_PAIRS: LasaRule[] = [
  {
    brandBase: 'DOLO',
    salt: 'Paracetamol',
    commonStrengths: ['500mg', '650mg'],
    highRiskDiff: 'Dolo 500 vs Dolo 650',
    guidance: 'Verify whether patient requires standard 500mg or high-dose 650mg antipyretic.',
  },
  {
    brandBase: 'AUGMENTIN',
    salt: 'Amoxicillin + Potassium Clavulanate',
    commonStrengths: ['375mg', '625 Duo', '1000mg'],
    highRiskDiff: 'Augmentin 375 vs Augmentin 625 Duo',
    guidance: 'Schedule H1 Antibiotic: ensure strength matches prescription exactly.',
  },
  {
    brandBase: 'CLAVAM',
    salt: 'Amoxicillin + Potassium Clavulanate',
    commonStrengths: ['375mg', '625mg'],
    highRiskDiff: 'Clavam 375 vs Clavam 625',
    guidance: 'Schedule H1 Antibiotic: double-check tablet count and dosage strength.',
  },
  {
    brandBase: 'TELMA',
    salt: 'Telmisartan',
    commonStrengths: ['20mg', '40mg', '80mg'],
    highRiskDiff: 'Telma 20 vs 40 vs 80',
    guidance: 'Cardiovascular antihypertensive: incorrect strength can cause hypotensive crisis.',
  },
  {
    brandBase: 'GLYCOMET',
    salt: 'Metformin',
    commonStrengths: ['500mg', '850mg', '1000mg', 'GP 1', 'GP 2'],
    highRiskDiff: 'Glycomet plain vs Glycomet GP (combination with Glimepiride)',
    guidance: 'Antidiabetic: mixing plain Metformin with combination GP causes acute hypoglycemia.',
  },
  {
    brandBase: 'AMLONG',
    salt: 'Amlodipine',
    commonStrengths: ['2.5mg', '5mg', '10mg'],
    highRiskDiff: 'Amlong 2.5 vs Amlong 5',
    guidance: 'Antihypertensive calcium-channel blocker: verify exact prescribed milligrams.',
  },
  {
    brandBase: 'PAN',
    salt: 'Pantoprazole',
    commonStrengths: ['20mg', '40mg', 'D'],
    highRiskDiff: 'Pan 40 vs Pan D (with Domperidone)',
    guidance: 'Verify if prescription includes Domperidone prokinetic component.',
  },
  {
    brandBase: 'AZITHRAL',
    salt: 'Azithromycin',
    commonStrengths: ['250mg', '500mg'],
    highRiskDiff: 'Azithral 250 vs Azithral 500',
    guidance: 'Antibiotic: adult standard is 500mg, pediatric/renal requires 250mg.',
  },
]

export interface LasaCheckResult {
  hasConflict: boolean
  matchedRule: LasaRule | null
  warningMessage: string | null
  requiresPharmacistConfirmation: boolean
}

/**
 * Checks whether an AI-detected item has a potential Look-Alike / Sound-Alike ambiguity.
 */
export function checkLasaSafety(
  detectedBrand: string,
  detectedStrength?: string | null,
  matchedProductStrength?: string | null,
  detectionConfidence: number = 0.95
): LasaCheckResult {
  const normBrand = (detectedBrand || '').toUpperCase().trim()

  const rule = COMMON_INDIAN_LASA_PAIRS.find(r => normBrand.includes(r.brandBase))

  if (!rule) {
    // If no rule matches but overall detection confidence is lower than 90%, require confirmation
    if (detectionConfidence < 0.90) {
      return {
        hasConflict: true,
        matchedRule: null,
        warningMessage: 'Visual confidence is below 90%. Pharmacist 1-tap verification recommended.',
        requiresPharmacistConfirmation: true,
      }
    }
    return {
      hasConflict: false,
      matchedRule: null,
      warningMessage: null,
      requiresPharmacistConfirmation: false,
    }
  }

  // If detected strength conflicts with catalog product strength
  const detStr = (detectedStrength || '').replace(/[^0-9]/g, '')
  const catStr = (matchedProductStrength || '').replace(/[^0-9]/g, '')

  if (detStr && catStr && detStr !== catStr) {
    return {
      hasConflict: true,
      matchedRule: rule,
      warningMessage: `LASA Alert: Detected ${rule.highRiskDiff}. Camera reads ${detectedStrength}, catalog matched ${matchedProductStrength}.`,
      requiresPharmacistConfirmation: true,
    }
  }

  // If confidence on LASA drug is below 95%, enforce confirmation
  if (detectionConfidence < 0.95) {
    return {
      hasConflict: true,
      matchedRule: rule,
      warningMessage: `High-Risk Drug (${rule.brandBase}): Visual match is ${Math.round(detectionConfidence * 100)}%. Confirm strength before billing.`,
      requiresPharmacistConfirmation: true,
    }
  }

  return {
    hasConflict: false,
    matchedRule: rule,
    warningMessage: null,
    requiresPharmacistConfirmation: false,
  }
}
