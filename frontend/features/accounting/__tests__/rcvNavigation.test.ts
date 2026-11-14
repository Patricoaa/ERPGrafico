import { describe, expect, it } from 'vitest'
import { ACCOUNTING_TABS, getAccountingConfigSubTab, getRcvSubTab, RCV_SUB_TABS } from '../navigation'

describe('navegación RCV', () => {
    it('resuelve los sub-tabs del RCV', () => {
        expect(getRcvSubTab('sales')?.href).toBe('/accounting/rcv/sales')
        expect(RCV_SUB_TABS.map(t => t.value)).toEqual(['purchases', 'sales', 'imports'])
    })

    it('registra el tab rcv tras closures', () => {
        const values = ACCOUNTING_TABS.map(t => t.value)
        expect(values.indexOf('rcv')).toBe(values.indexOf('closures') + 1)
        expect(ACCOUNTING_TABS.find(t => t.value === 'rcv')?.href).toBe('/accounting/rcv')
    })

    it('registra el sub-tab de configuración rcv', () => {
        expect(getAccountingConfigSubTab('rcv')?.href).toBe('/accounting/settings/rcv')
    })
})
