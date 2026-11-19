import { parseTallyResponse } from './tally-client'

describe('tally-client', () => {
  describe('parseTallyResponse', () => {
    it('successfully parses Tally success response', () => {
      const xml = `<RESPONSE>
        <CREATED>1</CREATED>
        <ALTERED>0</ALTERED>
        <ERRORS>0</ERRORS>
      </RESPONSE>`

      const result = parseTallyResponse(xml)
      expect(result.success).toBe(true)
      expect(result.createdCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(result.lineErrors).toHaveLength(0)
    })

    it('extracts line errors when Tally returns errors', () => {
      const xml = `<RESPONSE>
        <CREATED>0</CREATED>
        <ALTERED>0</ALTERED>
        <ERRORS>1</ERRORS>
        <LINEERROR>Ledger 'Sales - Medicines' does not exist!</LINEERROR>
      </RESPONSE>`

      const result = parseTallyResponse(xml)
      expect(result.success).toBe(false)
      expect(result.errorCount).toBe(1)
      expect(result.lineErrors).toContain("Ledger 'Sales - Medicines' does not exist!")
    })

    it('handles altered vouchers count correctly', () => {
      const xml = `<RESPONSE>
        <CREATED>0</CREATED>
        <ALTERED>2</ALTERED>
        <ERRORS>0</ERRORS>
      </RESPONSE>`

      const result = parseTallyResponse(xml)
      expect(result.success).toBe(true)
      expect(result.alteredCount).toBe(2)
    })
  })
})
