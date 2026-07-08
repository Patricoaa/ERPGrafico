interface OrderLine {
    is_manufacturable?: boolean;
    product_type?: string;
    quantity?: number | string;
    quantity_delivered?: number | string;
    quantity_received?: number | string;
    delivered_quantity?: number | string;
    received_quantity?: number | string;
    [key: string]: unknown;
}

interface PaymentDetail {
    payment_type?: string;
    payment_method?: string;
    transaction_number?: string;
    is_pending_registration?: boolean;
    [key: string]: unknown;
}

interface OrderBase {
    work_orders?: Array<{ status: string; production_progress?: number }>;
    lines?: Array<OrderLine>;
    items?: Array<OrderLine>;
    related_documents?: {
        invoices?: Array<{ status: string; number: string }>;
        payments?: Array<PaymentDetail>;
    };
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    status?: string;
    payment_status?: string;
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

interface NoteBase {
    sale_order?: unknown;
    status?: string;
    lines?: Array<OrderLine>;
    items?: Array<OrderLine>;
    related_stock_moves?: Array<{ state: string }>;
    po_receiving_status?: string;
    number?: string;
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    related_documents?: { payments?: Array<PaymentDetail> };
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

interface InvoiceBase {
    sale_order?: unknown;
    status?: string;
    order_delivery_status?: string;
    po_receiving_status?: string;
    lines?: Array<OrderLine>;
    items?: Array<OrderLine>;
    related_stock_moves?: Array<{ state: string }>;
    number?: string;
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    related_documents?: { payments?: Array<PaymentDetail> };
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

export const getHubStatuses = (order: OrderBase) => {
    // 1. Production
    // Visible if order has manufacturable items or existing work orders
    const showProduction = (order.work_orders?.length ?? 0) > 0 || (order.lines || order.items || []).some((l) => l.is_manufacturable)
    const activeOTs = order.work_orders?.filter((ot) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum, ot) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    let prodStatus = 'neutral' // default / pending
    if (!showProduction) prodStatus = 'not_applicable'
    else if (totalOTs > 0 && totalOTProgress === 100) prodStatus = 'success'
    else if (totalOTs > 0 && totalOTProgress > 0) prodStatus = 'active'
    else prodStatus = 'neutral'

    // 2. Logistics
    // Visible if there are physical items
    const lines = order.lines || order.items || []
    const showLogistics = lines.length > 0 && !lines.every((l) => l.product_type === 'SUBSCRIPTION')

    let logStatus = 'neutral'
    if (!showLogistics) logStatus = 'not_applicable'
    else {
        const totalOrdered = lines.reduce((acc, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)
        let logisticsProgress = 0
        if (totalOrdered > 0) {
            const totalProcessed = lines.reduce((acc, line) => {
                const processed = (line.quantity_delivered || line.quantity_received || 0)
                return acc + (parseFloat(String(processed)) || 0)
            }, 0)
            logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
        } else if (lines.length > 0) {
            logisticsProgress = 100
        }

        if (logisticsProgress === 100) logStatus = 'success'
        else if (logisticsProgress > 0) logStatus = 'active'
    }

    // 3. Billing
    const invoices = order.related_documents?.invoices || []
    const billingIsComplete = invoices.length > 0 && !invoices.some((inv) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    )
    const billingStatus = billingIsComplete ? 'success' : 'neutral'

    // 4. Treasury
    const payments = order.serialized_payments || order.payments_detail || order.related_documents?.payments || []

    // Check if fully paid
    const pending = parseFloat(String(order.pending_amount || 0))
    const isPaid = (order.status === 'PAID' || order.payment_status === 'PAID' || (pending <= 0))

    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pending < parseFloat(String(order.total || 0)) || payments.length > 0) treasuryStatus = 'active'

    // 5. Origin Document
    let originStatus = 'neutral'
    if (order.status === 'CANCELLED') originStatus = 'destructive'
    else if (order.status !== 'DRAFT') originStatus = 'success'

    return {
        production: prodStatus,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        origin: originStatus,
        hasPendingTransactions: false
    }
}

export const getNoteHubStatuses = (note: NoteBase) => {
    // Determine type
    const isSale = !!note.sale_order

    // 1. Origin (For Notes in Hub, it's always success)
    let originStatus = 'success'
    if (note.status === 'CANCELLED') originStatus = 'destructive'

    // 2. Logistics
    const lines = note.lines || note.items || []
    const totalOrdered = lines.reduce((acc, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)

    let logisticsProgress = 0
    if (totalOrdered > 0) {
        const totalProcessed = lines.reduce((acc, line) => {
            const processedField = isSale
                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

            const processed = line[processedField as keyof OrderLine] || 0
            return acc + (parseFloat(String(processed)) || 0)
        }, 0)
        logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    } else if (lines.length > 0 || ((note.related_stock_moves?.length ?? 0) > 0)) {
        logisticsProgress = 100
    }

    let logStatus = 'neutral'
    if (logisticsProgress === 100) logStatus = 'success'
    else if (logisticsProgress > 0) logStatus = 'active'
    else if (note.po_receiving_status === 'RECEIVED') logStatus = 'success'

    // 3. Billing
    const hasFolio = note.status !== 'DRAFT' && note.number && note.number !== 'Draft'
    const billingStatus = hasFolio ? 'success' : 'neutral'

    // 4. Treasury
    const payments = note.serialized_payments || note.payments_detail || note.related_documents?.payments || []

    const pendingAmount = parseFloat(String(note.pending_amount || 0))
    const totalAmount = parseFloat(String(note.total || 0))
    const isPaid = (note.status === 'PAID' || (pendingAmount <= 0))
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pendingAmount < totalAmount || payments.length > 0) treasuryStatus = 'active'

    return {
        origin: originStatus,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logisticsProgress,
        hasPendingTransactions: false,
        isComplete: logStatus === 'success' && billingStatus === 'success' && treasuryStatus === 'success'
    }
}

export const getInvoiceHubStatuses = (invoice: InvoiceBase) => {
    const isSale = !!invoice.sale_order

    // 1. Origin
    let originStatus = 'neutral'
    if (invoice.status === 'CANCELLED') originStatus = 'destructive'
    else if (invoice.status === 'DRAFT') originStatus = 'active'
    else originStatus = 'success'

    // 2. Logistics
    let logStatus = 'neutral'
    let logisticsProgress = 0
    if (invoice.order_delivery_status === 'DELIVERED' || invoice.po_receiving_status === 'RECEIVED') {
        logStatus = 'success'
        logisticsProgress = 100
    } else {
        const lines = invoice.lines || invoice.items || []
        const totalOrdered = lines.reduce((acc, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)

        if (totalOrdered > 0) {
            const totalProcessed = lines.reduce((acc, line) => {
                const processedField = isSale
                    ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                    : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')
                const processed = line[processedField as keyof OrderLine] || 0
                return acc + (parseFloat(String(processed)) || 0)
            }, 0)
            logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
        } else if ((invoice.related_stock_moves?.length ?? 0) > 0) {
            const anyCompleted = invoice.related_stock_moves?.some((m) => m.state === 'done') ?? false
            if (anyCompleted) logisticsProgress = 100
        }

        if (logisticsProgress === 100) logStatus = 'success'
        else if (logisticsProgress > 0) logStatus = 'active'
    }

    // 3. Billing
    const hasFolio = invoice.status !== 'DRAFT' && invoice.number && invoice.number !== 'Draft'
    const billingStatus = hasFolio ? 'success' : 'neutral'

    // 4. Treasury
    const payments = invoice.serialized_payments || invoice.payments_detail || invoice.related_documents?.payments || []

    const pendingAmount = parseFloat(String(invoice.pending_amount || 0))
    const totalAmount = parseFloat(String(invoice.total || 0))
    const isPaid = (invoice.status === 'PAID' || (pendingAmount <= 0))
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pendingAmount < totalAmount || payments.length > 0) treasuryStatus = 'active'

    return {
        origin: originStatus,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logisticsProgress,
        hasPendingTransactions: false
    }
}


// Helper to prevent duplicate prefixes (e.g. OCS-OCS-123)
import { formatEntityDisplay } from '@/lib/entity-registry'

export const formatEntity = (prefix: string, number: string | number, displayId?: string): string => {
    if (displayId) return displayId
    if (prefix === 'FACT') return formatEntityDisplay('billing.invoice', { number })
    if (prefix === 'OC') return formatEntityDisplay('purchasing.purchaseorder', { number })
    if (prefix === 'NV') return formatEntityDisplay('sales.saleorder', { number })
    if (prefix === 'DES') return formatEntityDisplay('sales.saledelivery', { number })
    if (prefix === 'REC') return formatEntityDisplay('purchasing.purchasereceipt', { number })
    if (prefix === 'DEV') return formatEntityDisplay('sales.salereturn', { number })
    if (prefix === 'MOV') return formatEntityDisplay('inventory.stockmove', { id: number })
    if (prefix === 'CAS' || prefix === 'ING' || prefix === 'EGR') return formatEntityDisplay('treasury.treasurymovement', { id: number })
    const numStr = String(number || '')
    return `${prefix}-${numStr}`
}
