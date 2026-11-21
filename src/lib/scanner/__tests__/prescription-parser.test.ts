import { describe, it, expect } from 'vitest'
import { parseDosageFromLine } from '../prescription-parser'

describe('Zero-LLM Prescription Dosage Pattern Parser', () => {
  it('correctly parses numerical grid schedules (1-0-1, 1-0-0, 0-0-1)', () => {
    const d1 = parseDosageFromLine('Tab Augmentin 625mg 1-0-1 x 5 days after food')
    expect(d1.formulation).toBe('Tab')
    expect(d1.strength).toBe('625MG')
    expect(d1.frequency).toBe('1-0-1')
    expect(d1.duration).toBe('5 days')
    expect(d1.timing).toBe('AFTER FOOD')

    const d2 = parseDosageFromLine('Cap Omeprazole 20mg 1-0-0 empty stomach 14 days')
    expect(d2.formulation).toBe('Cap')
    expect(d2.strength).toBe('20MG')
    expect(d2.frequency).toBe('1-0-0')
    expect(d2.duration).toBe('14 days')
    expect(d2.timing).toBe('EMPTY STOMACH')
  })

  it('correctly parses clinical medical shorthand (TDS, BD, OD, SOS, HS)', () => {
    const d1 = parseDosageFromLine('Syp Paracetamol 250mg TDS x 3 days')
    expect(d1.formulation).toBe('Syp')
    expect(d1.strength).toBe('250MG')
    expect(d1.frequency).toBe('TDS')
    expect(d1.duration).toBe('3 days')

    const d2 = parseDosageFromLine('Tab Pantocid 40mg OD before food')
    expect(d2.formulation).toBe('Tab')
    expect(d2.strength).toBe('40MG')
    expect(d2.frequency).toBe('OD')
    expect(d2.timing).toBe('BEFORE FOOD')

    const d3 = parseDosageFromLine('Tab Voveran 50mg SOS')
    expect(d3.formulation).toBe('Tab')
    expect(d3.frequency).toBe('SOS')
  })
})
