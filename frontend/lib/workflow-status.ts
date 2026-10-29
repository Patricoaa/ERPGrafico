import type { BadgeIntent } from '@/lib/badge-resolvers'
interface OrderLine {
    is_manufacturable?: boolean;
    requires_advanced_manufacturing?: boolean;
    product_type?: string;
    quantity?: number | string;
    quantity_delivered?: number | string;
    quantity_received?: number | string;
    delivered_quantity?: number | string;
    received_quantity?: number | string;
    work_order_summary?: { id?: number | string | null } | null;
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
    /** Resumen tipado de la orden (ADR-0083 U6). */
    invoices?: Array<{ status?: string; number?: string }>;
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    status?: string;
    payment_status?: string;
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

/**
 * Minimal structural input of `getHubStatuses` / `billingStage`: only the fields they read,
 * all optional and nullable, without an index signature. Any order-like API type (sale order,
 * purchase order, serializer variants) is assignable without a cast (ADR-0087 R5).
 */
export interface HubOrderSource {
    readonly work_orders?: ReadonlyArray<{ readonly status: string; readonly production_progress?: number | null }> | null
    readonly lines?: ReadonlyArray<HubOrderLine> | null
    readonly items?: ReadonlyArray<HubOrderLine> | null
    readonly invoices?: ReadonlyArray<{ readonly status?: string | null; readonly number?: string | null }> | null
    readonly invoicing_status?: string | null
    readonly serialized_payments?: ReadonlyArray<unknown> | null
    readonly payments_detail?: ReadonlyArray<unknown> | null
    readonly status?: string | null
    readonly payment_status?: string | null
    readonly pending_amount?: number | string | null
    readonly total?: number | string | null
    /** Backend-computed: true when there are manufacturable lines without a finalized work order. */
    readonly has_pending_work_orders?: boolean | null
}

export interface HubOrderLine {
    readonly is_manufacturable?: boolean | null
    readonly product_type?: string | null
    readonly requires_advanced_manufacturing?: boolean | null
    readonly quantity?: number | string | null
    readonly quantity_delivered?: number | string | null
    readonly quantity_received?: number | string | null
    readonly work_order_summary?: { readonly id?: number | string | null } | null
}

interface NoteBase {
    sale_order?: unknown;
    status?: string;
    lines?: Array<OrderLine>;
    items?: Array<OrderLine>;
    po_receiving_status?: string;
    number?: string;
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

interface InvoiceInternal {
    sale_order?: unknown;
    status?: string;
    order_delivery_status?: string;
    po_receiving_status?: string;
    work_orders?: Array<{ status: string; production_progress?: number }>;
    lines?: Array<OrderLine>;
    items?: Array<OrderLine>;
    number?: string;
    serialized_payments?: Array<PaymentDetail>;
    payments_detail?: Array<PaymentDetail>;
    pending_amount?: number | string;
    total?: number | string;
    [key: string]: unknown;
}

/**
 * Intención visual de un paso del ciclo. Los estados de paso ('active', 'neutral'…) no son
 * estados de negocio: pasados a StatusBadge sin intención, 'active' se resuelve como ACTIVE
 * (verde, "Activo") y un paso en curso se veía igual que uno completado.
 */
export const STAGE_INTENT: Record<string, BadgeIntent> = {
    success: 'success',
    active: 'warning',
    warning: 'warning',
    neutral: 'neutral',
    destructive: 'destructive',
    not_applicable: 'neutral',
}

export function stageIntent(stageStatus: string | null | undefined): BadgeIntent {
    return STAGE_INTENT[stageStatus ?? ''] ?? 'neutral'
}

/**
 * Paso "Facturación" del ciclo de OV/OC — fuente única para tarjeta (lista) y ficha (ADR-0083).
 * Solo cuentan las facturas emitidas (con folio): un borrador sin folio no es facturación.
 * - neutral (vacío): sin facturas emitidas, aunque haya borradores ("Folio pendiente");
 * - active: facturación parcial (`invoicing_status` PARTIAL, ADR-0081) o emitidas + borradores;
 * - success: todo facturado y ninguna factura sin folio.
 */
export function billingStage(order: HubOrderSource): { billingStatus: string; billingFolioPending: boolean } {
    const invoices = (order.invoices || []).filter((inv) => inv.status !== 'CANCELLED')
    const isDraft = (inv: { readonly status?: string | null; readonly number?: string | null }) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    const issued = invoices.filter((inv) => !isDraft(inv))
    const billingFolioPending = invoices.some(isDraft)
    const invoicingStatus = typeof order.invoicing_status === 'string' ? order.invoicing_status : null
    const fullyInvoiced = invoicingStatus ? invoicingStatus === 'INVOICED' : issued.length > 0
    let billingStatus = 'neutral'
    if (issued.length > 0) billingStatus = fullyInvoiced && !billingFolioPending ? 'success' : 'active'
    return { billingStatus, billingFolioPending }
}

export function isLineManufacturable(line: HubOrderLine | OrderLine): boolean {
    return Boolean(
        line.is_manufacturable ||
        line.requires_advanced_manufacturing ||
        line.product_type === 'MANUFACTURABLE'
    )
}

export const getHubStatuses = (order: HubOrderSource) => {
    // 1. Production
    // Visible if order has manufacturable items or existing work orders
    const lines = order.lines || order.items || []
    const mfgLines = lines.filter(isLineManufacturable)
    const activeOTs = order.work_orders?.filter((ot) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const showProduction = totalOTs > 0 || mfgLines.length > 0
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum, ot) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    const hasUnassignedMfgLine =
        (mfgLines.length > 0 && totalOTs === 0) ||
        mfgLines.some((l) => !l.work_order_summary?.id)

    let prodStatus = 'neutral' // default / pending
    if (!showProduction) prodStatus = 'not_applicable'
    else if (hasUnassignedMfgLine) prodStatus = 'warning'
    else if (totalOTs > 0 && totalOTProgress === 100) prodStatus = 'success'
    else if (totalOTs > 0 && totalOTProgress > 0) prodStatus = 'active'
    else prodStatus = 'neutral'

    // 2. Logistics
    // Visible if there are physical items
    const showLogistics = lines.length > 0 && !lines.every((l) => l.product_type === 'SUBSCRIPTION')

    let logStatus = 'neutral'
    let logisticsProgress = 0
    if (!showLogistics) logStatus = 'not_applicable'
    else {
        const totalOrdered = lines.reduce((acc, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)
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

    // 3. Billing — completa solo con todo facturado (ADR-0081 `invoicing_status`) Y foliado.
    const { billingStatus, billingFolioPending } = billingStage(order)

    // 4. Treasury
    const payments = order.serialized_payments || order.payments_detail || []

    // Check if fully paid
    const pending = parseFloat(String(order.pending_amount || 0))
    const isPaid = (order.payment_status === 'PAID' || (pending <= 0))

    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pending < parseFloat(String(order.total || 0)) || payments.length > 0) treasuryStatus = 'active'

    // 5. Origin Document
    let originStatus = 'neutral'
    if (order.status === 'CANCELLED') originStatus = 'destructive'
    else if (order.status !== 'DRAFT') originStatus = 'success'

    const totalVal = parseFloat(String(order.total || 0))
    const treasuryProgress = totalVal > 0 ? Math.min(100, Math.round((1 - (pending / totalVal)) * 100)) : 0

    return {
        production: prodStatus,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        origin: originStatus,
        hasPendingTransactions: false,
        billingFolioPending,
        productionProgress: Math.round(totalOTProgress),
        logisticsProgress,
        treasuryProgress,
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
    } else if (lines.length > 0) {
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
    const payments = note.serialized_payments || note.payments_detail || []

    const pendingAmount = parseFloat(String(note.pending_amount || 0))
    const totalAmount = parseFloat(String(note.total || 0))
    const isPaid = (note.payment_status === 'PAID' || (pendingAmount <= 0))
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pendingAmount < totalAmount || payments.length > 0) treasuryStatus = 'active'

    const treasuryProgress = totalAmount > 0 ? Math.min(100, Math.round((1 - (pendingAmount / totalAmount)) * 100)) : 0

    return {
        origin: originStatus,
        production: 'not_applicable',
        productionProgress: 0,
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logisticsProgress,
        treasuryProgress,
        hasPendingTransactions: false,
        isComplete: logStatus === 'success' && billingStatus === 'success' && treasuryStatus === 'success'
    }
}

export const getInvoiceHubStatuses = (invoice: InvoiceInternal) => {
    const isSale = !!invoice.sale_order
    const lines: OrderLine[] = invoice.lines || invoice.items || []

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
        }

        if (logisticsProgress === 100) logStatus = 'success'
        else if (logisticsProgress > 0) logStatus = 'active'
    }

    // 3. Billing
    const hasFolio = invoice.status !== 'DRAFT' && invoice.number && invoice.number !== 'Draft'
    const billingStatus = hasFolio ? 'success' : 'neutral'

    // 4. Treasury
    const payments = invoice.serialized_payments || invoice.payments_detail || []

    const pendingAmount = parseFloat(String(invoice.pending_amount || 0))
    const totalAmount = parseFloat(String(invoice.total || 0))
    const isPaid = (invoice.payment_status === 'PAID' || (pendingAmount <= 0))
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pendingAmount < totalAmount || payments.length > 0) treasuryStatus = 'active'

    const treasuryProgress = totalAmount > 0 ? Math.min(100, Math.round((1 - (pendingAmount / totalAmount)) * 100)) : 0

    // 5. Production (Optional)
    const mfgLines = lines.filter(isLineManufacturable)
    const activeOTs = (invoice.work_orders || []).filter((ot) => ot.status !== 'CANCELLED')
    const totalOTs = activeOTs.length
    const showProduction = totalOTs > 0 || mfgLines.length > 0
    let prodProgress = 0
    if (totalOTs > 0) {
        prodProgress = activeOTs.reduce((sum, ot) => sum + (ot.production_progress || 0), 0) / totalOTs
    }

    const hasUnassignedMfgLine =
        (mfgLines.length > 0 && totalOTs === 0) ||
        mfgLines.some((l: OrderLine) => !l.work_order_summary?.id)

    let prodStatus = 'neutral'
    if (!showProduction) prodStatus = 'not_applicable'
    else if (hasUnassignedMfgLine) prodStatus = 'warning'
    else if (totalOTs > 0 && prodProgress === 100) prodStatus = 'success'
    else if (totalOTs > 0 && prodProgress > 0) prodStatus = 'active'
    else prodStatus = 'neutral'

    return {
        origin: originStatus,
        production: prodStatus,
        productionProgress: Math.round(prodProgress),
        logistics: logStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logisticsProgress,
        treasuryProgress,
        hasPendingTransactions: false
    }
}

export const getPurchaseHubStatuses = (order: OrderBase) => {
    // 1. Origin
    let originStatus = 'neutral'
    if (order.status === 'CANCELLED') originStatus = 'destructive'
    else if (order.status !== 'DRAFT') originStatus = 'success'

    // 2. Billing — misma regla que la OV (facturado completo y foliado)
    const { billingStatus, billingFolioPending } = billingStage(order)

    // 3. Treasury
    const payments = order.serialized_payments || order.payments_detail || []
    const pending = parseFloat(String(order.pending_amount || 0))
    const isPaid = (order.payment_status === 'PAID' || (pending <= 0))
    let treasuryStatus = 'neutral'
    if (isPaid) treasuryStatus = 'success'
    else if (pending < parseFloat(String(order.total || 0)) || payments.length > 0) treasuryStatus = 'active'

    // 4. Logistics (Reception)
    const lines = order.lines || order.items || []
    const totalOrdered = lines.reduce((acc, line) => acc + (parseFloat(String(line.quantity)) || 0), 0)
    let receptionProgress = 0
    if (totalOrdered > 0) {
        const totalReceived = lines.reduce((acc, line) => {
            const received = (line.quantity_received || line.received_quantity || 0)
            return acc + (parseFloat(String(received)) || 0)
        }, 0)
        receptionProgress = Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
    } else if (lines.length > 0) {
        receptionProgress = 100
    }
    let logStatus = 'neutral'
    if (receptionProgress === 100) logStatus = 'success'
    else if (receptionProgress > 0) logStatus = 'active'

    const totalVal = parseFloat(String(order.total || 0))
    const treasuryProgress = totalVal > 0 ? Math.min(100, Math.round((1 - (pending / totalVal)) * 100)) : 0

    return {
        origin: originStatus,
        billing: billingStatus,
        treasury: treasuryStatus,
        logistics: logStatus,
        reception: logStatus,
        receptionProgress,
        treasuryProgress,
        billingFolioPending,
        hasPendingTransactions: false
    }
}

/**
 * Determina si una orden comercial (OV u OC) tiene todos sus ejes operativos completados.
 * Devuelve true si el documento está confirmado/activo y todos sus ejes aplicables
 * (origen, facturación, tesorería, logística y producción) están en estado 'success'.
 */
export function isOrderCompleted(order: HubOrderSource): boolean {
    if (!order.status || order.status === 'CANCELLED' || order.status === 'DRAFT') {
        return false
    }
    const s = getHubStatuses(order)
    return (
        s.origin === 'success' &&
        s.billing === 'success' &&
        s.treasury === 'success' &&
        (s.logistics === 'success' || s.logistics === 'not_applicable') &&
        (s.production === 'success' || s.production === 'not_applicable')
    )
}

/**
 * Minimal shape required by isInvoiceCompleted / isNoteCompleted.
 * All fields are optional and readonly so any invoice-like API type is assignable.
 */
export interface InvoiceBase {
    readonly status?: string | null
    readonly number?: string | null
    readonly order_delivery_status?: string | null
    readonly po_receiving_status?: string | null
    readonly payment_status?: string | null
    readonly pending_amount?: number | string | null
    readonly total?: number | string | null
    readonly sale_order?: unknown
    readonly dte_type?: string | null
    readonly lines?: ReadonlyArray<{
        readonly quantity?: number | string | null
        readonly quantity_delivered?: number | string | null
        readonly quantity_received?: number | string | null
        readonly delivered_quantity?: number | string | null
        readonly received_quantity?: number | string | null
    }> | null
    readonly items?: ReadonlyArray<{
        readonly quantity?: number | string | null
        readonly quantity_delivered?: number | string | null
        readonly quantity_received?: number | string | null
    }> | null
}

/**
 * Determines if an invoice (factura o nota) has all its operational axes completed.
 * Returns true when the document has a folio (POSTED), logistics are done, and is fully paid.
 */
export function isInvoiceCompleted(invoice: InvoiceBase): boolean {
    if (!invoice.status || invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
        return false
    }
    const hasFolio = invoice.status !== 'DRAFT' && !!invoice.number && invoice.number !== 'Draft'
    if (!hasFolio) return false
    // Treasury: fully paid
    const pending = parseFloat(String(invoice.pending_amount ?? 0))
    const isPaid = invoice.payment_status === 'PAID' || pending <= 0
    if (!isPaid) return false
    // Logistics: delivery/reception status flags or line-level progress
    if (invoice.order_delivery_status === 'DELIVERED' || invoice.po_receiving_status === 'RECEIVED') {
        return true
    }
    const lines = (invoice.lines ?? invoice.items ?? []) as ReadonlyArray<{
        quantity?: number | string | null
        quantity_delivered?: number | string | null
        quantity_received?: number | string | null
        delivered_quantity?: number | string | null
        received_quantity?: number | string | null
    }>
    if (lines.length === 0) return true
    const totalOrdered = lines.reduce((acc, l) => acc + (parseFloat(String(l.quantity ?? 0)) || 0), 0)
    if (totalOrdered <= 0) return true
    const isSale = !!invoice.sale_order
    const totalProcessed = lines.reduce((acc, l) => {
        const processed = isSale
            ? (l.quantity_delivered ?? l.delivered_quantity ?? 0)
            : (l.quantity_received ?? l.received_quantity ?? 0)
        return acc + (parseFloat(String(processed)) || 0)
    }, 0)
    return totalProcessed >= totalOrdered
}



