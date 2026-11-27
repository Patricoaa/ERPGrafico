import { describe, expect, it } from 'vitest'
import type { NoteWizardPayload } from '@/features/notes'
import { buildSalesNoteFormData, parseSalesNoteSource } from '../salesNoteAdapter'

const rawInvoice = {
    id: 7,
    number: '1234',
    dte_type: 'FACTURA',
    dte_type_display: 'Factura Electrónica',
    total: '5950.00',
    customer_tax_id: '76.123.456-7',
    lines: [
        {
            id: 1, product: 10, product_name: 'Tarjetas', product_type: 'STORABLE',
            track_inventory: true, quantity: '5', quantity_delivered: '3', unit_price: '1000', tax_rate: null,
        },
        { id: 2, product: 11, product_name: 'Diseño', product_type: 'MANUFACTURABLE', track_inventory: true, quantity: 1, unit_price: 500, tax_rate: 0 },
    ],
}

describe('parseSalesNoteSource', () => {
    it('normaliza decimales string y aplica IVA por defecto cuando tax_rate es null', () => {
        const doc = parseSalesNoteSource(rawInvoice)
        expect(doc.label).toBe('Factura Electrónica 1234')
        expect(doc.originalTotal).toBe(5950)
        expect(doc.invoiceId).toBe(7)
        expect(doc.counterpartyRut).toBe('76.123.456-7')
        expect(doc.lines[0]).toMatchObject({ originalQuantity: 3, noteUnitPrice: 1000, taxAmountPerUnit: 190, createsStockMove: true })
    })

    it('respeta tax_rate 0 y no genera movimiento de stock para fabricables', () => {
        const doc = parseSalesNoteSource(rawInvoice)
        expect(doc.lines[1]).toMatchObject({ taxAmountPerUnit: 0, createsStockMove: false })
    })

    it('marca exentas por tipo DTE', () => {
        expect(parseSalesNoteSource({ ...rawInvoice, dte_type: 'FACTURA_EXENTA' }).isExempt).toBe(true)
    })

    it('soporta facturas de compra con unit_cost o unit_price_net sin unit_price', () => {
        const purchaseInvoice = {
            id: 9,
            number: '12',
            dte_type: 'FACTURA',
            dte_type_display: 'Factura Electrónica',
            total: '297500.00',
            lines: [
                {
                    id: 1,
                    product: 34,
                    product_name: 'Mantención',
                    quantity: '1',
                    unit_cost: '250000',
                    tax_rate: '19',
                },
            ],
        }
        const doc = parseSalesNoteSource(purchaseInvoice)
        expect(doc.lines[0]).toMatchObject({
            lineId: 1,
            productId: 34,
            noteUnitPrice: 250000,
            taxAmountPerUnit: 47500,
        })
    })

    it('rechaza respuestas con forma inválida', () => {
        expect(() => parseSalesNoteSource({ id: 'x' })).toThrow()
    })
})

describe('buildSalesNoteFormData', () => {
    it('serializa el payload al contrato del backend', () => {
        const payload: NoteWizardPayload = {
            noteType: 'NOTA_CREDITO', totalNet: 1000, totalTax: 190, total: 1190,
            lines: [{ lineId: 1, productId: 10, productName: 'T', originalQuantity: 3, noteQuantity: 1, noteUnitPrice: 1000, taxAmountPerUnit: 190 }],
            registration: { documentNumber: '55', documentDate: '2026-11-19', isPending: false, attachment: null, pickedFiscalMatchId: 9 },
            payment: { method: null, amount: 1190, treasuryAccountId: null, paymentMethodId: null, isPending: false },
        }
        const fd = buildSalesNoteFormData(7, payload)
        expect(fd.get('original_invoice_id')).toBe('7')
        expect(fd.get('note_type')).toBe('NOTA_CREDITO')
        expect(fd.get('fiscal_match_id')).toBe('9')
        expect(fd.has('payment_data')).toBe(false)
        const items = JSON.parse(String(fd.get('selected_items'))) as Record<string, unknown>[]
        expect(items[0]).toMatchObject({ line_id: 1, quantity: 1, tax_amount: 190 })
    })
})
