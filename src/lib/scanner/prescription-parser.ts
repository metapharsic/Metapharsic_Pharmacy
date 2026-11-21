/**
 * Prescription (Rx) Dosage Parser & Fuzzy Catalog Matcher
 * Metapharsic Rx - Zero-LLM Architecture
 *
 * Implements:
 * 1. Demographic extraction (Doctor Name, Medical Reg No, Patient Name, Age, Date).
 * 2. Deterministic Dosage Pattern Regex Engine (1-0-1, OD, BD, TDS, SOS, Duration, Timing).
 * 3. PostgreSQL Trigram Similarity Catalog Matcher with confidence gating:
 *    - >= 0.85: Auto-matched with active inventory product (100% automated).
 *    - < 0.85: Flagged with Top 3 inventory matches for 1-click pharmacist disambiguation.
 */

import prisma from '@/lib/db/prisma'
import { cleanMedicineName, calculateTrigramSimilarity } from './entity-matcher'
import type { OcrBoundingBox } from './deterministic-ocr-client'
import { normalizeExpiryDate } from './spatial-table-reconstructor'

export interface ParsedDosage {
  formulation: string // Tab, Cap, Syp, Inj, etc.
  strength?: string   // 500mg, 625mg, 100ml
  frequency: string   // 1-0-1, BD, TDS, etc.
  timing?: string     // Before Food, After Food
  duration?: string   // 5 days, 1 week
  instructions?: string
}

export interface MatchedInventoryCandidate {
  productId: string
  productName: string
  genericName?: string | null
  stock: number
  rack?: string | null
  mrp: number
  similarity: number
}

export interface PrescriptionMedicineItem {
  id: string
  rawText: string
  candidateName: string
  dosage: ParsedDosage
  matchedProduct?: MatchedInventoryCandidate | null
  alternativeCandidates: MatchedInventoryCandidate[]
  confidence: number
  status: 'AUTO_MATCHED' | 'NEEDS_REVIEW'
}

export interface ParsedPrescriptionResult {
  success: boolean
  doctor: {
    name?: string
    regNumber?: string
    clinicOrHospital?: string
    phone?: string
  }
  patient: {
    name?: string
    age?: number
    gender?: 'M' | 'F' | 'OTHER'
    phone?: string
  }
  prescriptionDate: string
  medicines: PrescriptionMedicineItem[]
  highConfidenceCount: number
  needsReviewCount: number
  rawLines: string[]
}

// ─────────────────────────────────────────────────────────────
// Dosage Regex Patterns
// ─────────────────────────────────────────────────────────────

const FORMULATION_REGEX = /\b(TAB|TABLET|TABLETS|CAP|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|OINT|OINTMENT|GEL|DROPS?|SUSP|SUSPENSION|SOL|SOLUTION|CREAM|RESPULES?|ROTACAPS?|LOTION|POWDER)\b/i
const STRENGTH_REGEX = /\b(\d+(?:\.\d+)?\s*(?:MG|ML|GM|MCG|IU))\b/i

const FREQUENCY_GRID_REGEX = /\b(1-0-1|1-0-0|0-0-1|0-1-0|1-1-1|1-1-1-1|0-1-1|1-1-0|2-0-2|1\/2-0-1\/2)\b/i
const FREQUENCY_SHORTHAND_REGEX = /\b(OD|BD|BID|TDS|TID|QID|HS|Q4H|Q6H|SOS|PRN|STAT)\b/i

const TIMING_REGEX = /\b(BEFORE\s*FOOD|AFTER\s*FOOD|EMPTY\s*STOMACH|AC|PC|WITH\s*FOOD|AT\s*BEDTIME)\b/i
const DURATION_REGEX = /\b(?:FOR\s*)?(\d+)\s*(DAYS?|WEEKS?|MONTHS?|WKS?|MOS?|D)\b|\b[Xx]\s*(\d+)\s*(DAYS?|D)\b/i

export function parseDosageFromLine(line: string): ParsedDosage {
  let formulation = 'Tab'
  const fMatch = line.match(FORMULATION_REGEX)
  if (fMatch) {
    formulation = fMatch[1].charAt(0).toUpperCase() + fMatch[1].slice(1).toLowerCase()
  }

  let strength: string | undefined
  const sMatch = line.match(STRENGTH_REGEX)
  if (sMatch) strength = sMatch[1].toUpperCase()

  let frequency = '1-0-1'
  const gridMatch = line.match(FREQUENCY_GRID_REGEX)
  if (gridMatch) {
    frequency = gridMatch[1]
  } else {
    const shortMatch = line.match(FREQUENCY_SHORTHAND_REGEX)
    if (shortMatch) frequency = shortMatch[1].toUpperCase()
  }

  let timing: string | undefined
  const tMatch = line.match(TIMING_REGEX)
  if (tMatch) timing = tMatch[1].toUpperCase()

  let duration: string | undefined
  const dMatch = line.match(DURATION_REGEX)
  if (dMatch) {
    const val = dMatch[1] || dMatch[3]
    const unit = dMatch[2] || dMatch[4] || 'days'
    duration = `${val} ${unit.toLowerCase()}`
  }

  return {
    formulation,
    strength,
    frequency,
    timing,
    duration,
  }
}

// ─────────────────────────────────────────────────────────────
// Full Prescription Document Parser
// ─────────────────────────────────────────────────────────────

export async function parsePrescriptionDocument(
  boxes: OcrBoundingBox[],
  branchId?: string
): Promise<ParsedPrescriptionResult> {
  // Sort boxes top-to-bottom and cluster lines (within 7px vertical)
  const sorted = [...boxes].sort((a, b) => a.box[1] - b.box[1])
  const lines: string[] = []
  let currentY = -1
  let currentLine: string[] = []

  for (const b of sorted) {
    const yCenter = (b.box[1] + b.box[3]) / 2
    if (currentY === -1 || Math.abs(yCenter - currentY) <= 7) {
      currentLine.push(b.text)
      currentY = yCenter
    } else {
      if (currentLine.length > 0) lines.push(currentLine.join(' ').trim())
      currentLine = [b.text]
      currentY = yCenter
    }
  }
  if (currentLine.length > 0) lines.push(currentLine.join(' ').trim())

  const fullText = lines.join('\n')

  // 1. Doctor Demographics
  let doctorName: string | undefined
  let doctorReg: string | undefined
  let clinicName: string | undefined

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const l = lines[i].trim()
    if (!doctorName && /\b(DR\.?|DOCTOR)\s+([A-Z\s\.]+)/i.test(l)) {
      const match = l.match(/\b(DR\.?\s+[A-Z\s\.]+)/i)
      if (match) doctorName = match[1].trim()
    }
    if (!doctorReg && /(?:REG(?:N|\.|ISTRATION)?\s*(?:NO)?|MCI|SMC)[\s.:#\-]+([A-Z0-9\-_]+)/i.test(l)) {
      const match = l.match(/(?:REG(?:N|\.|ISTRATION)?\s*(?:NO)?|MCI|SMC)[\s.:#\-]+([A-Z0-9\-_]+)/i)
      if (match) doctorReg = match[1].trim()
    }
    if (!clinicName && /(?:CLINIC|HOSPITAL|HEALTHCARE|MEDICAL\s*CENTRE)/i.test(l)) {
      clinicName = l
    }
  }

  // 2. Patient Demographics
  let patientName: string | undefined
  let patientAge: number | undefined
  let patientGender: 'M' | 'F' | 'OTHER' | undefined
  let patientPhone: string | undefined

  const patMatch = fullText.match(/(?:PATIENT|NAME|MR\.?|MRS\.?|MS\.?)[\s.:#\-]+([A-Z\s]{3,25})/i)
  if (patMatch && !/DATE|AGE|SEX|GENDER/i.test(patMatch[1])) {
    patientName = patMatch[1].trim()
  }

  const ageMatch = fullText.match(/\b(\d{1,2})\s*(?:YRS?|YEARS?|Y|M|F)\b/i)
  if (ageMatch) patientAge = parseInt(ageMatch[1], 10)

  if (/\b(MALE|\bM\b)\b/i.test(fullText)) patientGender = 'M'
  else if (/\b(FEMALE|\bF\b)\b/i.test(fullText)) patientGender = 'F'

  const phoneMatch = fullText.match(/(?:PH|MOB|PHONE)[\s.:#\-]+(?:\+91[\s-]*)?([6-9]\d{9})\b/i)
  if (phoneMatch) patientPhone = phoneMatch[1]

  // Prescription Date
  let prescriptionDate = new Date().toISOString().slice(0, 10)
  const dateMatch = fullText.match(/\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/)
  if (dateMatch) prescriptionDate = normalizeExpiryDate(dateMatch[1])

  // 3. Extract Candidate Medicine Lines (Skipping Header Demographics)
  const candidateMedicineLines: string[] = []
  let bodyReached = false

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx].trim()
    if (/Rx|\bMEDICINES?\b|\bPRESCRIPTION\b/i.test(l)) {
      bodyReached = true
      continue
    }

    if (bodyReached || idx >= 4) {
      // Must contain medicine keywords, dosage form, or frequency pattern
      const hasDosagePattern =
        FORMULATION_REGEX.test(l) ||
        FREQUENCY_GRID_REGEX.test(l) ||
        FREQUENCY_SHORTHAND_REGEX.test(l) ||
        STRENGTH_REGEX.test(l) ||
        /^\d+[\.\)]\s*[A-Z]/i.test(l) // e.g. "1. Augmentin 625"

      const isMetaLine =
        /CLINIC|HOSPITAL|PHONE|TIMINGS|ADDRESS|SIGNATURE|DOCTOR|REG|DATE|AGE|SEX|PATIENT/i.test(l)

      if (hasDosagePattern && !isMetaLine && l.length >= 4) {
        candidateMedicineLines.push(l)
      }
    }
  }

  // 4. PostgreSQL Inventory Cross-Matching
  // Fetch active products in memory / DB for rapid fuzzy matching
  const catalogProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      genericName: true,
      mrp: true,
      batches: {
        where: { quantity: { gt: 0 } },
        select: { quantity: true },
      },
    },
    take: 500, // Top active inventory items
  })

  const medicines: PrescriptionMedicineItem[] = []

  for (let i = 0; i < candidateMedicineLines.length; i++) {
    const raw = candidateMedicineLines[i]
    const dosage = parseDosageFromLine(raw)

    // Strip dosage keywords to isolate the core medicine brand name
    let cleanBrand = cleanMedicineName(raw)
      .replace(/^\d+[\.\)]\s*/, '') // Remove list index '1.'
      .replace(FREQUENCY_GRID_REGEX, '')
      .replace(FREQUENCY_SHORTHAND_REGEX, '')
      .replace(TIMING_REGEX, '')
      .replace(DURATION_REGEX, '')
      .trim()

    if (!cleanBrand || cleanBrand.length < 3) {
      cleanBrand = raw.slice(0, 20).trim()
    }

    // Rank catalog candidates by Trigram similarity
    const scoredCandidates: MatchedInventoryCandidate[] = catalogProducts
      .map((p) => {
        const simName = calculateTrigramSimilarity(cleanBrand, p.name)
        const simGeneric = p.genericName ? calculateTrigramSimilarity(cleanBrand, p.genericName) : 0
        const bestSim = Math.max(simName, simGeneric)
        const totalStock = p.batches
          ? p.batches.reduce((acc: number, b: { quantity: number }) => acc + b.quantity, 0)
          : 0

        return {
          productId: p.id,
          productName: p.name,
          genericName: p.genericName,
          stock: totalStock,
          rack: 'A1',
          mrp: Number(p.mrp) || 0,
          similarity: Math.round(bestSim * 100) / 100,
        }
      })
      .filter((c) => c.similarity >= 0.35) // Filter out noise
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)

    const topMatch = scoredCandidates[0]
    const confidence = topMatch ? topMatch.similarity : 0.4
    const status: 'AUTO_MATCHED' | 'NEEDS_REVIEW' = confidence >= 0.85 ? 'AUTO_MATCHED' : 'NEEDS_REVIEW'

    medicines.push({
      id: `RX-ITEM-${i + 1}`,
      rawText: raw,
      candidateName: cleanBrand,
      dosage,
      matchedProduct: topMatch || null,
      alternativeCandidates: scoredCandidates,
      confidence,
      status,
    })
  }

  const highConfidenceCount = medicines.filter((m) => m.status === 'AUTO_MATCHED').length
  const needsReviewCount = medicines.filter((m) => m.status === 'NEEDS_REVIEW').length

  return {
    success: medicines.length > 0 || !!doctorName,
    doctor: {
      name: doctorName,
      regNumber: doctorReg,
      clinicOrHospital: clinicName,
    },
    patient: {
      name: patientName,
      age: patientAge,
      gender: patientGender,
      phone: patientPhone,
    },
    prescriptionDate,
    medicines,
    highConfidenceCount,
    needsReviewCount,
    rawLines: lines,
  }
}
