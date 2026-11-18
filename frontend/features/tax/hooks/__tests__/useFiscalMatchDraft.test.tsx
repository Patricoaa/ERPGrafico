import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFiscalMatchDraft } from '../useFiscalMatchDraft'
import type { FiscalMatchDetail, FiscalMatchSearchItem, CandidateMovement } from '../../types/fiscalMatch'

const mv = (id: number): CandidateMovement => ({ id, amount: '1000', created_at: '2026-11-01T10:00:00Z', method: 'Tarjeta' })
const item = (id: number, over: Partial<FiscalMatchSearchItem> = {}): FiscalMatchSearchItem => ({
    id, kind: 'x', label: `L${id}`, counterparty: '', date: '2026-11-01', amount: '1000', score: 80, warnings: [], ...over,
})
const group = (over: Partial<FiscalMatchDetail> = {}): FiscalMatchDetail => ({
    id: 1, direction: 'sale', status: 'PENDING', status_display: '', erp_state: 'MATCHED', tuu_state: 'PENDING', rcv_state: 'PENDING',
    dte_type: 39, issue_date: null, erp_amount: null, tuu_amount: null, rcv_amount: null, notice: '', closed_period_alert: false,
    issue_error: '', invoice: { id: 5, display_id: 'B-5', dte_type: '39', number: '5', status: 'POSTED', total: '1000', date: null },
    terminal_sales: [], rcv_documents: [], counterparty_rut: '', fiscal_period: '', rcv_linked_manually: false,
    issue_attempted_at: null, evaluated_at: null, ...over,
}) as FiscalMatchDetail
const orphan = (over: Partial<FiscalMatchDetail> = {}) => group({
    invoice: null,
    terminal_sales: [{ id: 81, transaction_at: '', sale_amount: '1000', document_type: 39, payment_type: 'CARD', matched_movement: null, linked_manually: false }],
    rcv_documents: [{ id: 9, folio: '123', dte_type: 39, issue_date: null, total_amount: '1000', period: '' }],
    ...over,
})
const setup = (g: FiscalMatchDetail) => renderHook(({ g }) => useFiscalMatchDraft(g), { initialProps: { g } })

describe('useFiscalMatchDraft', () => {
    it('ERP: solo huérfano y uno solo (reemplaza)', () => {
        const a = setup(group())
        let r = { ok: true } as ReturnType<typeof a.result.current.select>
        act(() => { r = a.result.current.select('erp', item(10)) })
        expect(r.ok).toBe(false)
        expect(a.result.current.isDirty).toBe(false)

        const b = setup(orphan())
        act(() => { b.result.current.select('erp', item(10)) })
        act(() => { b.result.current.select('erp', item(11)) })
        expect(b.result.current.pending).toEqual([{ op: 'link', part: 'erp', id: 11, payments: null }])
    })

    it('TUU: varios, cada uno con su pago (auto si hay uno)', () => {
        const h = setup(group())
        act(() => { h.result.current.select('tuu', item(1, { compatible_movements: [mv(7)] })) })
        act(() => { h.result.current.select('tuu', item(2, { compatible_movements: [mv(8), mv(9)] })) })
        expect(h.result.current.needsPayment).toBe(true)
        act(() => { h.result.current.setPayment(2, 9) })
        expect(h.result.current.needsPayment).toBe(false)
        expect(h.result.current.pending).toEqual([
            { op: 'link', part: 'tuu', id: 1, movement: 7 },
            { op: 'link', part: 'tuu', id: 2, movement: 9 },
        ])
    })

    it('RCV: varios en boletas, uno en facturas', () => {
        const boleta = setup(group({ dte_type: 39 }))
        act(() => { boleta.result.current.select('rcv', item(1)) })
        act(() => { boleta.result.current.select('rcv', item(2)) })
        expect(boleta.result.current.pending).toHaveLength(2)
        const factura = setup(group({ dte_type: 33 }))
        act(() => { factura.result.current.select('rcv', item(1)) })
        act(() => { factura.result.current.select('rcv', item(2)) })
        expect(factura.result.current.pending).toEqual([{ op: 'link', part: 'rcv', id: 2 }])
    })

    it('un aviso bloqueante impide seleccionar y devuelve el motivo', () => {
        const h = setup(group())
        let r = { ok: true } as ReturnType<typeof h.result.current.select>
        act(() => { r = h.result.current.select('tuu', item(1, { warnings: [{ code: 'TYPE_INCOMPATIBLE', label: 'Efectivo solo en boletas', blocking: true }] })) })
        expect(r).toEqual({ ok: false, reason: 'Efectivo solo en boletas' })
        expect(h.result.current.isDirty).toBe(false)
    })

    it('link erp de un huérfano lleva los pagos de sus ventas propias y la consecuencia', () => {
        const h = setup(orphan())
        act(() => { h.result.current.select('erp', item(10, { payments_by_sale: { '81': [mv(70), mv(71)] } })) })
        expect(h.result.current.needsPayment).toBe(true)
        expect(h.result.current.pending[0].payments).toBeNull()
        act(() => { h.result.current.setPayment(81, 71) })
        expect(h.result.current.pending).toEqual([{ op: 'link', part: 'erp', id: 10, payments: { 81: 71 } }])
        expect(h.result.current.paymentOf(81)).toBe(71)
        expect(h.result.current.consequences).toContain('La boleta SII folio 123 se moverá también')

        const auto = setup(orphan())
        act(() => { auto.result.current.select('erp', item(10, { payments_by_sale: { '81': [mv(70)] } })) })
        expect(auto.result.current.pending[0].payments).toEqual({ 81: 70 })
    })

    it('remove / unselect / discard y estados derivados', () => {
        const g = group({ rcv_documents: [{ id: 3, folio: '1', dte_type: 39, issue_date: null, total_amount: '1', period: '' }] })
        const h = setup(g)
        expect(h.result.current.stateOf('rcv', 3)).toBe('linked')
        expect(h.result.current.stateOf('rcv', 4)).toBe('idle')
        act(() => { h.result.current.remove('rcv', 3) })
        act(() => { h.result.current.remove('erp', 5) })
        expect(h.result.current.stateOf('rcv', 3)).toBe('toRemove')
        expect(h.result.current.pending).toEqual([{ op: 'unlink', part: 'rcv', id: 3 }])
        act(() => { h.result.current.unselect('rcv', 3) })
        expect(h.result.current.stateOf('rcv', 3)).toBe('linked')
        act(() => { h.result.current.select('rcv', item(4)) })
        expect(h.result.current.stateOf('rcv', 4)).toBe('selected')
        act(() => { h.result.current.discard() })
        expect(h.result.current.isDirty).toBe(false)
    })

    it('markError marca la tarjeta y conserva los demás cambios', () => {
        const h = setup(group())
        act(() => { h.result.current.select('rcv', item(1)) })
        act(() => { h.result.current.select('rcv', item(2)) })
        act(() => { h.result.current.markError(1, 'Pago tomado') })
        expect(h.result.current.stateOf('rcv', 2)).toBe('error')
        expect(h.result.current.stateOf('rcv', 1)).toBe('selected')
        expect(h.result.current.pending).toHaveLength(2)
    })

    it('reconcile descarta lo que ya no está disponible y avisa', () => {
        const h = setup(group())
        act(() => { h.result.current.select('tuu', item(81, { label: '#81', compatible_movements: [mv(7)] })) })
        act(() => { h.result.current.select('rcv', item(2)) })
        let notices: string[] = []
        act(() => { notices = h.result.current.reconcile(group(), { tuu: [], rcv: [2] }) })
        expect(notices).toEqual(['1 cambio ya no aplica: la venta TUU #81 se cuadró en otro grupo'])
        expect(h.result.current.pending).toEqual([{ op: 'link', part: 'rcv', id: 2 }])
    })

    it('una venta TUU seleccionada anuncia el RCV que viaja con ella', () => {
        const h = setup(group())
        act(() => { h.result.current.select('tuu', item(5, { compatible_movements: [mv(7)], carried_rcv: [{ id: 40, folio: '777' }] })) })
        expect(h.result.current.consequences).toEqual(['La boleta SII folio 777 se moverá también'])
        expect(h.result.current.stateOf('rcv', 40)).toBe('linked')
        act(() => { h.result.current.unselect('tuu', 5) })
        expect(h.result.current.consequences).toEqual([])
        expect(h.result.current.stateOf('rcv', 40)).toBe('idle')
    })
})
