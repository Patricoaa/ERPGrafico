import { describe, expect, it } from 'vitest'
import {
    ATTACHMENT_REQUIRED_DTE,
    AUTO_ISSUED_DTE_SALE,
    emptyDteRegistration,
    getDteDescription,
    getDteLabel,
    getDteSiiCode,
    isDteClassAutoIssued,
} from '../dte'

describe('dte helpers and constants', () => {
    it('returns labels for all classes', () => {
        expect(getDteLabel('BOLETA')).toBe('Boleta Electrónica')
        expect(getDteLabel('FACTURA')).toBe('Factura Electrónica')
        expect(getDteLabel('PURCHASE_INV')).toBe('Factura de Compra')
        expect(getDteLabel('NOTA_CREDITO')).toBe('Nota de Crédito')
        expect(getDteLabel('NOTA_DEBITO')).toBe('Nota de Débito')
    })

    it('returns correct SII codes', () => {
        expect(getDteSiiCode('FACTURA')).toBe(33)
        expect(getDteSiiCode('PURCHASE_INV')).toBe(33)
        expect(getDteSiiCode('FACTURA_EXENTA')).toBe(34)
        expect(getDteSiiCode('BOLETA')).toBe(39)
        expect(getDteSiiCode('BOLETA_EXENTA')).toBe(41)
        expect(getDteSiiCode('NOTA_DEBITO')).toBe(56)
        expect(getDteSiiCode('NOTA_CREDITO')).toBe(61)
    })

    it('determines auto-issued DTEs only for sales', () => {
        expect(isDteClassAutoIssued('BOLETA', 'sale')).toBe(true)
        expect(isDteClassAutoIssued('BOLETA_EXENTA', 'sale')).toBe(true)
        expect(isDteClassAutoIssued('BOLETA', 'purchase')).toBe(false)
        expect(isDteClassAutoIssued('FACTURA', 'sale')).toBe(false)
        expect(isDteClassAutoIssued('FACTURA', 'purchase')).toBe(false)
    })

    it('identifies required attachment DTEs', () => {
        expect(ATTACHMENT_REQUIRED_DTE.has('FACTURA')).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has('PURCHASE_INV')).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has('BOLETA')).toBe(false)
    })

    it('creates an empty registration object with default values', () => {
        const reg = emptyDteRegistration('FACTURA', '2026-11-18')
        expect(reg.dteClass).toBe('FACTURA')
        expect(reg.issueDate).toBe('2026-11-18')
        expect(reg.isPending).toBe(false)
        expect(reg.folio).toBe('')
        expect(reg.attachment).toBeNull()
        expect(reg.pickedFiscalMatchId).toBeNull()
    })

    it('provides description for sale and purchase', () => {
        expect(getDteDescription('FACTURA', 'sale')).toContain('Venta')
        expect(getDteDescription('FACTURA', 'purchase')).toContain('proveedor')
    })
})
