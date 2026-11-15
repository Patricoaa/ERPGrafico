import { describe, expect, it } from 'vitest'
import { ACCOUNTING_TABS, getAccountingConfigSubTab, getRcvSubTab, RCV_SUB_TABS, resolveAccountingNav } from '../navigation'

describe('navegación RCV', () => {
    it('resuelve los sub-tabs del RCV', () => {
        expect(getRcvSubTab('sales')?.href).toBe('/accounting/rcv/sales')
        expect(RCV_SUB_TABS.map(t => t.value)).toEqual(['purchases', 'sales', 'imports', 'reconciliation'])
    })

    it('registra el tab rcv tras closures', () => {
        const values = ACCOUNTING_TABS.map(t => t.value)
        expect(values.indexOf('rcv')).toBe(values.indexOf('closures') + 1)
        expect(ACCOUNTING_TABS.find(t => t.value === 'rcv')?.href).toBe('/accounting/rcv')
    })

    it('registra el sub-tab de configuración rcv', () => {
        expect(getAccountingConfigSubTab('rcv')?.href).toBe('/accounting/settings/rcv')
    })

    it('registra la sub-pestaña de cuadre fiscal', () => {
        expect(getRcvSubTab('reconciliation')).toMatchObject({
            label: 'Cuadre',
            href: '/accounting/rcv/reconciliation',
            iconName: 'scale',
            headerTitle: 'Cuadre fiscal',
            headerDescription: 'ERP frente a TUU y el RCV del SII, por período.',
        })
    })

    it('marca activa la sub-pestaña según la ruta', () => {
        expect(resolveAccountingNav('/accounting/rcv/reconciliation')).toEqual({ activeValue: 'rcv', subActiveValue: 'reconciliation' })
        expect(resolveAccountingNav('/accounting/rcv')).toEqual({ activeValue: 'rcv', subActiveValue: 'purchases' })
        expect(resolveAccountingNav('/accounting/settings')).toEqual({ activeValue: 'config', subActiveValue: 'vat-rates' })
        expect(resolveAccountingNav('/accounting')).toEqual({ activeValue: 'ledger', subActiveValue: undefined })
    })
})
