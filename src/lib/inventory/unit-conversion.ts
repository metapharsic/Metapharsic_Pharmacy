// ─────────────────────────────────────────────────────────────
// Pharmaceutical Units of Measurement & Compound Units Engine
// Standard pharma packaging conversions:
// Simple: Box, Strip, Nos, Grams, Kg, Bottle, Vial, Blister
// Compound: 1 Box = 10 Strips, 1 Strip = 10 Nos, 1 Kg = 1000 Grams
// ─────────────────────────────────────────────────────────────

import type { UnitForTally } from '@/lib/tally/tally-types'

export interface UnitDefinition {
  name: string
  symbol: string
  isSimple: boolean
  decimalPlaces: number
  baseUnit?: string
  additionalUnit?: string
  conversion?: number
  description?: string
}

export const STANDARD_SIMPLE_UNITS: UnitDefinition[] = [
  { name: 'Box', symbol: 'BOX', isSimple: true, decimalPlaces: 0, description: 'Outer carton or box packaging' },
  { name: 'Strip', symbol: 'STRIP', isSimple: true, decimalPlaces: 0, description: 'Medicine blister or foil strip' },
  { name: 'Nos', symbol: 'NOS', isSimple: true, decimalPlaces: 0, description: 'Individual tablets/capsules/units' },
  { name: 'Grams', symbol: 'GMS', isSimple: true, decimalPlaces: 2, description: 'Weight in grams (ointments, powders)' },
  { name: 'Kilograms', symbol: 'KGS', isSimple: true, decimalPlaces: 3, description: 'Bulk active ingredients in kg' },
  { name: 'Bottle', symbol: 'BTL', isSimple: true, decimalPlaces: 0, description: 'Syrups, suspensions, liquids' },
  { name: 'Vial', symbol: 'VIAL', isSimple: true, decimalPlaces: 0, description: 'Injectables & vaccines' },
  { name: 'Ampoule', symbol: 'AMP', isSimple: true, decimalPlaces: 0, description: 'Single-use liquid injectables' },
  { name: 'Tube', symbol: 'TUBE', isSimple: true, decimalPlaces: 0, description: 'Creams, gels, and ointments' },
]

export const STANDARD_COMPOUND_UNITS: UnitDefinition[] = [
  {
    name: 'Box of 10 Strips',
    symbol: 'BOX/10STRIP',
    isSimple: false,
    decimalPlaces: 0,
    baseUnit: 'Box',
    additionalUnit: 'Strip',
    conversion: 10,
    description: '1 Box = 10 Strips',
  },
  {
    name: 'Box of 100 Nos',
    symbol: 'BOX/100NOS',
    isSimple: false,
    decimalPlaces: 0,
    baseUnit: 'Box',
    additionalUnit: 'Nos',
    conversion: 100,
    description: '1 Box = 100 Nos',
  },
  {
    name: 'Strip of 10 Nos',
    symbol: 'STRIP/10NOS',
    isSimple: false,
    decimalPlaces: 0,
    baseUnit: 'Strip',
    additionalUnit: 'Nos',
    conversion: 10,
    description: '1 Strip = 10 Nos (Tablets / Capsules)',
  },
  {
    name: 'Strip of 15 Nos',
    symbol: 'STRIP/15NOS',
    isSimple: false,
    decimalPlaces: 0,
    baseUnit: 'Strip',
    additionalUnit: 'Nos',
    conversion: 15,
    description: '1 Strip = 15 Nos (Tablets / Capsules)',
  },
  {
    name: 'Kilogram of 1000 Grams',
    symbol: 'KG/1000GMS',
    isSimple: false,
    decimalPlaces: 3,
    baseUnit: 'Kilograms',
    additionalUnit: 'Grams',
    conversion: 1000,
    description: '1 Kg = 1000 Grams',
  },
]

export const ALL_PHARMA_UNITS: UnitDefinition[] = [
  ...STANDARD_SIMPLE_UNITS,
  ...STANDARD_COMPOUND_UNITS,
]

export function getPharmaUnitsForTally(): UnitForTally[] {
  return ALL_PHARMA_UNITS.map((u) => ({
    name: u.name,
    symbol: u.symbol,
    isSimple: u.isSimple,
    decimalPlaces: u.decimalPlaces,
    baseUnit: u.baseUnit,
    additionalUnit: u.additionalUnit,
    conversion: u.conversion,
  }))
}

/**
 * Convert quantity between units.
 * E.g., convert 2 Boxes to Strips (1 Box = 10 Strips) -> 20 Strips.
 * E.g., convert 5 Nos from a 10-tab Strip -> 0.5 Strips.
 */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  customConversionRate?: number
): { quantity: number; rate: number } {
  if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return { quantity: qty, rate: 1 }
  }

  // Check compound units lookup
  const fromNorm = fromUnit.trim().toLowerCase()
  const toNorm = toUnit.trim().toLowerCase()

  // If custom conversion provided (e.g., product tabsPerStrip = 10)
  if (customConversionRate && customConversionRate > 0) {
    if ((fromNorm.includes('strip') || fromNorm.includes('box')) && (toNorm.includes('no') || toNorm.includes('tab'))) {
      return { quantity: qty * customConversionRate, rate: customConversionRate }
    }
    if ((fromNorm.includes('no') || fromNorm.includes('tab')) && (toNorm.includes('strip') || toNorm.includes('box'))) {
      return { quantity: qty / customConversionRate, rate: 1 / customConversionRate }
    }
  }

  // Standard predefined checks
  // Box to Strip: * 10
  if (fromNorm.includes('box') && toNorm.includes('strip')) {
    return { quantity: qty * 10, rate: 10 }
  }
  if (fromNorm.includes('strip') && toNorm.includes('box')) {
    return { quantity: qty / 10, rate: 0.1 }
  }

  // Strip to Nos: * 10
  if (fromNorm.includes('strip') && (toNorm.includes('no') || toNorm.includes('tab'))) {
    return { quantity: qty * 10, rate: 10 }
  }
  if ((fromNorm.includes('no') || fromNorm.includes('tab')) && toNorm.includes('strip')) {
    return { quantity: qty / 10, rate: 0.1 }
  }

  // Box to Nos: * 100
  if (fromNorm.includes('box') && (toNorm.includes('no') || toNorm.includes('tab'))) {
    return { quantity: qty * 100, rate: 100 }
  }
  if ((fromNorm.includes('no') || fromNorm.includes('tab')) && toNorm.includes('box')) {
    return { quantity: qty / 100, rate: 0.01 }
  }

  // Kg to Grams: * 1000
  if ((fromNorm.includes('kg') || fromNorm.includes('kilo')) && (toNorm.includes('gram') || toNorm.includes('gm'))) {
    return { quantity: qty * 1000, rate: 1000 }
  }
  if ((fromNorm.includes('gram') || fromNorm.includes('gm')) && (toNorm.includes('kg') || toNorm.includes('kilo'))) {
    return { quantity: qty / 1000, rate: 0.001 }
  }

  // Default fallback
  return { quantity: qty, rate: 1 }
}

/**
 * Calculate pro-rated unit price for loose/sub-unit dispensing.
 * E.g., Strip MRP is ₹30 for 10 tablets, customer buys 3 tablets -> ₹3 per tablet, line total ₹9.
 */
export function calculateSubUnitPrice(
  basePrice: number,
  packSize: number,
  quantitySold: number
): { unitPrice: number; totalAmount: number } {
  const effectivePackSize = packSize > 0 ? packSize : 1
  const unitPrice = Math.round(((basePrice / effectivePackSize) + Number.EPSILON) * 100) / 100
  const totalAmount = Math.round(((unitPrice * quantitySold) + Number.EPSILON) * 100) / 100
  return { unitPrice, totalAmount }
}
