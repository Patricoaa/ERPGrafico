export const getPurchaseHubStatuses = (order: any) => {
    // 1. Origin Document
    let originStatus = 'neutral'
    if (order.status === 'CANCELLED') originStatus = 'destructive'
    else if (order.status !== 'DRAFT') originStatus = 'success'

    // 2. Reception (replaces Logistics for purchases)
    // Check if products have been received
    const lines = order.lines || order.items || []
    const receipts = order.related_documents?.receipts || []

    let receptionStatus = 'neutral'
    if (lines.length > 0) {
        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
        let receptionProgress = 0

        if (totalOrdered > 0) {
            const totalReceived = lines.reduce((acc: number, line: any) => {
                const received = (line.quantity_received || 0)
                return acc + (parseFloat(received) || 0)
            }, 0)
            receptionProgress = Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
        } else if (lines.length > 0) {
            receptionProgress = 100
        }

        if (receptionProgress === 100) receptionStatus = 'success'
        else if (receptionProgress > 0) receptionStatus = 'active'
    }

    // 3. Billing (supplier invoices registered)
    const invoices = order.related_documents?.invoices || []
    const billingIsComplete = invoices.length > 0 && !invoices.some((inv: any) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    )
    const billingStatus = billingIsComplete ? 'success' : 'neutral'

    // 4. Treasury (payments to supplier)
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

    return {
        origin: originStatus,
        reception: receptionStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        hasPendingTransactions: hasPendingTransactions
    }
}
