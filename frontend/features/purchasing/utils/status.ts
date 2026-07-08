export const getPurchaseHubStatuses = (order: Record<string, unknown>) => {
    let originStatus = 'neutral'
    if (order.status === 'CANCELLED') originStatus = 'destructive'
    else if (order.status !== 'DRAFT') originStatus = 'success'

    const lines = (order.lines || order.items || []) as Array<Record<string, unknown>>
    const relatedDocs = order.related_documents as Record<string, unknown> | undefined


    let receptionStatus = 'neutral'
    if (lines.length > 0) {
        const totalOrdered = lines.reduce((acc: number, line: Record<string, unknown>) => acc + (Number(line.quantity) || 0), 0)
        let receptionProgress = 0

        if (totalOrdered > 0) {
            const totalReceived = lines.reduce((acc: number, line: Record<string, unknown>) => {
                const received = (line.quantity_received || 0)
                return acc + (Number(received) || 0)
            }, 0)
            receptionProgress = Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
        } else if (lines.length > 0) {
            receptionProgress = 100
        }

        if (receptionProgress === 100) receptionStatus = 'success'
        else if (receptionProgress > 0) receptionStatus = 'active'
    }

    const invoices = (relatedDocs?.invoices as Array<Record<string, unknown>> | undefined) || []
    const billingIsComplete = invoices.length > 0 && !invoices.some((inv: Record<string, unknown>) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    )
    const billingStatus = billingIsComplete ? 'success' : 'neutral'

    const payments = (order.serialized_payments || order.payments_detail || relatedDocs?.payments || []) as Array<Record<string, unknown>>
    const hasPendingTransactions = payments.some((pay: Record<string, unknown>) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'TRANSFER' || pay.payment_method === 'CARD')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return (requiresTR && !Boolean(pay.transaction_number)) || Boolean(pay.is_pending_registration)
    })

    const isPaid = (order.status === 'PAID' || order.payment_status === 'PAID' || (Number(order.pending_amount) <= 0)) && !hasPendingTransactions

    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (Number(order.pending_amount) < Number(order.total) || hasPendingTransactions) treasuryStatus = 'active'

    return {
        origin: originStatus,
        reception: receptionStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        hasPendingTransactions: hasPendingTransactions
    }
}
