// Fuente única de los estados del ciclo (tarjeta de lista y ficha documental, ADR-0083).
export { getHubStatuses, getNoteHubStatuses, getInvoiceHubStatuses } from '@/lib/workflow-status'

// Helper to prevent duplicate prefixes (e.g. OCS-OCS-123)
import { formatEntityDisplay } from '@/lib/entity-registry'

export const formatEntity = (prefix: string, number: string | number, displayId?: string): string => {
    if (displayId) return displayId
    if (prefix === 'FACT') return formatEntityDisplay('billing.invoice', { number })
    if (prefix === 'OC') return formatEntityDisplay('purchasing.purchaseorder', { number })
    if (prefix === 'OV') return formatEntityDisplay('sales.saleorder', { number })
    if (prefix === 'DES') return formatEntityDisplay('sales.saledelivery', { number })
    if (prefix === 'REC') return formatEntityDisplay('purchasing.purchasereceipt', { number })
    if (prefix === 'DEV') return formatEntityDisplay('sales.salereturn', { number })
    if (prefix === 'MOV') return formatEntityDisplay('inventory.stockmove', { id: number })
    if (prefix === 'CAS' || prefix === 'ING' || prefix === 'EGR') return formatEntityDisplay('treasury.treasurymovement', { id: number })
    const numStr = String(number || '')
    return `${prefix}-${numStr}`
}
