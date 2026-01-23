import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Package,
    Banknote,
    History,
    FileBadge,
    X,
    Ban,
    Eye,
    FileEdit,
    Trash2,
    Hash,
    RotateCcw,
    PackageMinus,
    DollarSign,
    MinusCircle,
    PlusCircle
} from 'lucide-react'

/**
 * Purchase Order Action Registry
 * Defines all available actions for purchase orders with permission requirements
 */
export const purchaseOrderActions: ActionRegistry = {
    documents: {
        id: 'documents',
        label: 'Documentos',
        icon: FileText,
        actions: [
            {
                id: 'complete-folio',
                label: 'Registrar Folio',
                icon: FileEdit,
                requiredPermissions: ['billing.change_invoice'],
                checkAvailability: (order) => {
                    // Show if there's any invoice without a real folio number
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.some((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')
                },
                badge: { type: 'warning', label: 'Pendiente' },
                excludedStatus: ['CANCELLED']
            },
            {
                id: 'view-documents',
                label: 'Ver Documentos',
                icon: Eye,
                requiredPermissions: ['billing.view_invoice'],
                checkAvailability: (order) => (order.related_documents?.invoices?.length || 0) > 0
            }
        ]
    },

    receptions: {
        id: 'receptions',
        label: 'Recepciones',
        icon: Package,
        actions: [
            {
                id: 'register-reception',
                label: 'Registrar Recepción',
                icon: Package,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    // Show if not fully received and has physical products
                    const lines = order.lines || order.items || []
                    const hasProducts = lines.some((l: any) => l.product_type !== 'SERVICE' && (parseFloat(l.quantity_pending) || 0) > 0)
                    return order.receiving_status !== 'RECEIVED' && hasProducts
                },
                badge: { type: 'pending' }
            },
            {
                id: 'confirm-service-delivery',
                label: 'Confirmar Entrega de Servicio',
                icon: FileBadge,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    // Show if not fully received and has service products
                    const lines = order.lines || order.items || []
                    const hasServices = lines.some((l: any) => l.product_type === 'SERVICE' && (parseFloat(l.quantity_pending) || 0) > 0)
                    return order.receiving_status !== 'RECEIVED' && hasServices
                },
                badge: { type: 'pending' }
            },
            {
                id: 'register-merchandise-return',
                label: 'Devolver Mercadería',
                icon: PackageMinus,
                requiredPermissions: ['inventory.add_stockmove'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has received stockable products
                    const lines = order.lines || order.items || []
                    const hasStockableReceived = lines.some((line: any) =>
                        (line.quantity_received || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableReceived
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'view-receptions',
                label: 'Ver Recepciones',
                icon: Eye,
                requiredPermissions: ['inventory.view_stockmove'],
                checkAvailability: (order) => {
                    return (order.related_documents?.receipts?.length || 0) > 0
                }
            }
        ]
    },

    payments: {
        id: 'payments',
        label: 'Pagos',
        icon: Banknote,
        actions: [
            {
                id: 'register-payment',
                label: 'Registrar Pago',
                icon: Banknote,
                requiredPermissions: ['treasury.add_payment'],
                // Removed specific requiredStatus to rely on financial state
                checkAvailability: (order) => {
                    // Show if there's a pending amount or order is not paid
                    const hasPendingAmount = (order.pending_amount ?? 0) > 0
                    return hasPendingAmount || (order.status !== 'PAID' && order.status !== 'CANCELLED')
                },
                badge: { type: 'pending' },
                excludedStatus: ['CANCELLED']
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_payment'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has posted payments
                    const payments = order.related_documents?.payments || []
                    const hasPostedPayments = payments.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    )

                    return hasDraftInvoice && hasPostedPayments
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'payment-history',
                label: 'Historial de Pagos',
                icon: History,
                requiredPermissions: ['treasury.view_payment'],
                checkAvailability: (order) => {
                    const paymentsCount = order.related_documents?.payments?.length ||
                        order.serialized_payments?.length || 0
                    return paymentsCount > 0
                }
            },
        ]
    },

    notes: {
        id: 'notes',
        label: 'Notas de Crédito/Débito',
        icon: FileBadge,
        actions: [
            {
                id: 'create-credit-note',
                label: 'Crear Nota de Crédito',
                icon: MinusCircle,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    const hasInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    return hasInvoice
                },
                isDisabled: (order) => {
                    const hasIssuedInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' && ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    return !hasIssuedInvoice
                },
                disabledTooltip: "Debe registrar la factura antes de crear una nota de crédito"
            },
            {
                id: 'create-debit-note',
                label: 'Crear Nota de Débito',
                icon: PlusCircle,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    const hasInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    return hasInvoice
                },
                isDisabled: (order) => {
                    const hasIssuedInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' && ['FACTURA', 'PURCHASE_INV'].includes(inv.dte_type)
                    )
                    return !hasIssuedInvoice
                },
                disabledTooltip: "Debe registrar la factura antes de crear una nota de débito"
            }
        ]
    },

    returns: {
        id: 'returns',
        label: 'Devoluciones',
        icon: RotateCcw,
        actions: [
            {
                id: 'register-merchandise-return',
                label: 'Devolver Mercadería',
                icon: PackageMinus,
                requiredPermissions: ['inventory.add_stockmove'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has received stockable products
                    const hasStockableReceived = order.lines?.some((line: any) =>
                        (line.quantity_received || 0) > 0 && line.product?.track_inventory
                    )

                    return hasDraftInvoice && hasStockableReceived
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            },
            {
                id: 'register-payment-return',
                label: 'Devolver Pago',
                icon: DollarSign,
                requiredPermissions: ['treasury.add_payment'],
                checkAvailability: (order) => {
                    // Only if invoice is DRAFT
                    const hasDraftInvoice = order.related_documents?.invoices?.some(
                        (inv: any) => inv.status === 'DRAFT'
                    )

                    // Only if has posted payments
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    )

                    return hasDraftInvoice && hasPostedPayments
                },
                badge: { type: 'info', label: 'Solo DRAFT' }
            }
        ]
    },

    management: {
        id: 'management',
        label: 'Gestión',
        icon: X,
        actions: [
            {
                id: 'annul-document',
                label: 'Anular Documento',
                icon: Ban,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Only show if there's a posted invoice WITHOUT folio (Draft)
                    // Backend will block annulment if folio exists (fiscal requirement)
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.some((inv: any) =>
                        (inv.status === 'POSTED' || inv.status === 'PAID') &&
                        (inv.number === 'Draft' || !inv.number)
                    )
                },
                variant: 'destructive',
                badge: { type: 'warning', label: 'Solo sin folio' }
            },
            {
                id: 'delete-draft',
                label: 'Eliminar Borrador',
                icon: Trash2,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Show only if order is DRAFT and has no physical/financial impact
                    if (order.status !== 'DRAFT') return false

                    // Check for confirmed receipts (backend will block)
                    const hasConfirmedReceipts = order.related_documents?.receipts?.some(
                        (rec: any) => rec.status === 'CONFIRMED'
                    ) || false

                    // Check for posted payments (backend will block)
                    const hasPostedPayments = order.related_documents?.payments?.some(
                        (pay: any) => pay.journal_entry?.state === 'POSTED'
                    ) || false

                    // Only show if no receipts or payments
                    return !hasConfirmedReceipts && !hasPostedPayments
                },
                variant: 'destructive'
            }
        ]
    }
}
