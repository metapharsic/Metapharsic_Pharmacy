import { executeWorkerPharmaScan } from './pharma-scanner.worker'

describe('pharma-scanner.worker', () => {
  it('extracts all SKU components and initial batch from Augmentin strip', () => {
    const rawText = `AUGMENTIN 625 DUO
Amoxicillin and Potassium Clavulanate Tablets IP
B.No. 26D044
MFD. 09/2025
EXP. 08/2028
M.R.P. Rs. 204.50
INCL. OF ALL TAXES
10 Tablets
SCHEDULE H1 PRESCRIPTION DRUG - CAUTION
GlaxoSmithKline Pharmaceuticals Ltd.
GTIN: 08901234567891`

    const { entity, confidence } = executeWorkerPharmaScan(rawText, 'ALU_ALU')

    expect(entity.brandName).toBe('AUGMENTIN 625 DUO')
    expect(entity.genericName).toContain('Amoxicillin and Potassium Clavulanate')
    expect(entity.sku).toBe('AUGM-625-TAB-10')
    expect(entity.tabsPerStrip).toBe(10)
    expect(entity.unitOfMeasure).toBe('Strip')
    expect(entity.mrp).toBe(204.5)
    expect(entity.ptr).toBe(147.24)
    expect(entity.drugSchedule).toBe('H1')
    expect(entity.isPrescriptionRequired).toBe(true)
    expect(entity.initialBatch.batchNumber).toBe('26D044')
    expect(entity.initialBatch.expiryDate).toBe('2028-08-31')
    expect(confidence.overall).toBeGreaterThanOrEqual(80)
  })

  it('extracts components from vial injection carton', () => {
    const rawText = `MEROMAC 1G INJECTION
Meropenem Injection IP 1000 mg
B.No. MRC-26X99
MFD. 01/2026
EXP. 12/2028
M.R.P. Rs. 1450.00
1 Vial with Sterile Water for Injection
SCHEDULE H1 PRESCRIPTION DRUG - CAUTION
Macleods Pharmaceuticals Ltd.`

    const { entity } = executeWorkerPharmaScan(rawText, 'MONO_CARTON')

    expect(entity.brandName).toBe('MEROMAC 1G INJECTION')
    expect(entity.unitOfMeasure).toBe('Vial')
    expect(entity.mrp).toBe(1450)
    expect(entity.initialBatch.batchNumber).toBe('MRC-26X99')
    expect(entity.initialBatch.expiryDate).toBe('2028-12-31')
  })
})
