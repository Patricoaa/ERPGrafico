import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Package,
    Banknote,
    History,
    FileBadge,
    X,
    Eye,
    FileEdit,
    Trash2,
    Hash
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
                badge: { type: 'warning', label: 'Pendiente' }
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
                    // Show if there's a posted invoice with pending amount
                    const hasPostedInvoice = order.related_documents?.invoices?.some((inv: any) => inv.status === 'POSTED')
                    const hasPendingAmount = (order.pending_amount ?? 0) > 0
                    return hasPostedInvoice && hasPendingAmount
                },
                badge: { type: 'pending' }
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
                id: 'create-note',
                label: 'Crear Nota',
                icon: FileBadge,
                requiredPermissions: ['billing.add_invoice'],
                excludedStatus: ['DRAFT', 'CANCELLED'],
                checkAvailability: (order) => {
                    // Show if there's a posted invoice that's not a note
                    const hasValidInvoice = order.related_documents?.invoices?.some((inv: any) =>
                        inv.status !== 'DRAFT' &&
                        !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type)
                    )
                    return hasValidInvoice
                }
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
                icon: X,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Show if there's a posted invoice that's not cancelled
                    return order.related_documents?.invoices?.some((inv: any) =>
                        inv.status === 'POSTED' || inv.status === 'PAID'
                    )
                },
                variant: 'destructive'
            },
            {
                id: 'delete-draft',
                label: 'Eliminar Borrador',
                icon: Trash2,
                requiredPermissions: ['billing.delete_invoice'],
                checkAvailability: (order) => {
                    // Show only if there's a draft invoice (unpaid)
                    const invoices = order.related_documents?.invoices || order.invoices || []
                    return invoices.some((inv: any) => inv.status === 'DRAFT')
                },
                variant: 'destructive'
            }
        ]
    }
}
