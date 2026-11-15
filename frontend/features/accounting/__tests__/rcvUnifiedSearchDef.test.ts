import { describe, expect, it } from 'vitest'
import { rcvDocumentUnifiedSearchDef, rcvSaleUnifiedSearchDef } from '../unifiedSearchDef'

describe('filtros de documentos RCV', () => {
    it('compras expone estado y rango de fecha de emisión', () => {
        const status = rcvDocumentUnifiedSearchDef.filters?.find((f) => f.key === 'status')
        expect(status).toMatchObject({ type: 'single', serverParam: 'status' })
        const issueDate = rcvDocumentUnifiedSearchDef.dateFilters?.find((f) => f.key === 'issue_date')
        expect(issueDate?.options.length).toBeGreaterThan(0)
        for (const option of issueDate?.options ?? []) {
            expect(option).toMatchObject({ serverParamFrom: 'issue_date_from', serverParamTo: 'issue_date_to' })
        }
    })

    it('ventas conserva el rango de fecha pero no estado ni acuse', () => {
        const keys = (rcvSaleUnifiedSearchDef.filters ?? []).map((f) => f.key)
        expect(keys).not.toContain('status')
        expect(keys).not.toContain('acknowledgement')
        expect(rcvSaleUnifiedSearchDef.dateFilters?.[0]?.key).toBe('issue_date')
    })

    it('compras y ventas filtran por estado de cuadre', () => {
        for (const def of [rcvDocumentUnifiedSearchDef, rcvSaleUnifiedSearchDef]) {
            const filter = def.filters?.find((f) => f.key === 'match_status')
            expect(filter).toMatchObject({ type: 'single', serverParam: 'match_status' })
            expect(filter && 'options' in filter ? (filter.options ?? []).map((o) => o.value) : []).toContain('MATCHED')
        }
    })
})
