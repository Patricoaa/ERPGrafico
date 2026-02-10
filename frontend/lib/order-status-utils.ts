
export const getHubStatuses = (order: any) => {
    // 1. Production
    // Visible if order has manufacturable items or existing work orders
    const showProduction = order.work_orders?.length > 0 || (order.lines || order.items || []).some((l: any) => l.is_manufacturable)
    const totalOTs = order.work_orders?.length || 0
    const totalOTProgress = order.production_progress || 0

    let prodStatus = 'neutral' // default / pending
    if (!showProduction) prodStatus = 'not_applicable'
    else if (totalOTs > 0 && totalOTProgress === 100) prodStatus = 'success'
    else if (totalOTs > 0 && totalOTProgress > 0) prodStatus = 'active'
    else prodStatus = 'neutral'

    // 2. Logistics
    // Visible if there are physical items
    const lines = order.lines || order.items || []
    const showLogistics = lines.length > 0 && !lines.every((l: any) => l.product_type === 'SUBSCRIPTION')

    let logStatus = 'neutral'
    if (!showLogistics) logStatus = 'not_applicable'
    else {
        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
        let logisticsProgress = 0
        if (totalOrdered > 0) {
            const totalProcessed = lines.reduce((acc: number, line: any) => {
                const processed = (line.quantity_delivered || line.quantity_received || 0)
                return acc + (parseFloat(processed) || 0)
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
    const billingIsComplete = invoices.length > 0 && !invoices.some((inv: any) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    )
    const billingStatus = billingIsComplete ? 'success' : 'neutral'

    // 4. Treasury
    const payments = order.serialized_payments || order.payments_detail || order.related_documents?.payments || []
    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'TRANSFER' || pay.payment_method === 'CARD')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return (requiresTR && !pay.transaction_number) || pay.is_pending_registration
    })

    // Check if fully paid
    const isPaid = (order.status === 'PAID' || order.payment_status === 'PAID' || (parseFloat(order.pending_amount) <= 0)) && !hasPendingTransactions

    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (parseFloat(order.pending_amount) < parseFloat(order.total) || hasPendingTransactions) treasuryStatus = 'active'

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
        hasPendingTransactions: hasPendingTransactions
    }
}

export const getNoteHubStatuses = (note: any) => {
    // Determine type
    const isSale = !!note.sale_order

    // 1. Origin (For Notes in Hub, it's always success)
    let originStatus = 'success'
    if (note.status === 'CANCELLED') originStatus = 'destructive'

    // 2. Logistics
    const lines = note.lines || note.items || []
    const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)

    let logisticsProgress = 0
    if (totalOrdered > 0) {
        const totalProcessed = lines.reduce((acc: number, line: any) => {
            const processedField = isSale
                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

            const processed = line[processedField] || 0
            return acc + (parseFloat(processed) || 0)
        }, 0)
        logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    } else if (lines.length > 0 || (note.related_stock_moves?.length > 0)) {
        logisticsProgress = 100
    }

    let logStatus = 'neutral'
    if (logisticsProgress === 100) logStatus = 'success'
    else if (logisticsProgress > 0) logStatus = 'active'

    // 3. Billing
    const hasFolio = note.status !== 'DRAFT' && note.number && note.number !== 'Draft'
    const billingStatus = hasFolio ? 'success' : 'neutral'

    // 4. Treasury
    const payments = note.serialized_payments || note.payments_detail || note.related_documents?.payments || []
    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'TRANSFER' || pay.payment_method === 'CARD')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return (requiresTR && !pay.transaction_number) || pay.is_pending_registration
    })

    const isPaid = (note.status === 'PAID' || (parseFloat(note.pending_amount) <= 0)) && !hasPendingTransactions
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (parseFloat(note.pending_amount) < parseFloat(note.total) || hasPendingTransactions) treasuryStatus = 'active'

    return {
        origin: originStatus,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logisticsProgress,
        hasPendingTransactions,
        isComplete: logStatus === 'success' && billingStatus === 'success' && treasuryStatus === 'success'
    }
}

// Helper to prevent duplicate prefixes (e.g. OC-OC-123)
export const formatDocumentId = (prefix: string, number: string | number, displayId?: string) => {
    if (displayId) return displayId
    const numStr = String(number || '')
    const cleanPrefix = prefix.replace('-', '') // Handle both "OC" and "OC-" inputs if needed, though we usually pass "OC"

    // Check if it already starts with the prefix (case insensitive)
    if (numStr.toUpperCase().startsWith(cleanPrefix.toUpperCase())) {
        return numStr
    }
    return `${prefix}-${numStr}`
}
