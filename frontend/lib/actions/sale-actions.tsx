import type { ActionRegistry } from '@/types/actions'
import {
    FileText,
    Truck,
    Banknote,
    History,
    FileBadge,
    X,
    Eye,
    Package,
    Trash2,
    FileEdit
} from 'lucide-react'

/**
 * Sale Order Action Registry
 * Defines all available actions for sale orders with permission requirements
 */
export const saleOrderActions: ActionRegistry = {
    documents: {
        id: 'documents',
        label: 'Documentos',
        icon: FileText,
        actions: [
            {
                id: 'complete-folio',
                label: 'Emitir Documento',
                icon: FileEdit,
                requiredPermissions: ['billing.change_invoice'],
                checkAvailability: (order) => {
                    // Only show if there's a draft invoice
                    return order.invoices?.some((inv: any) => inv.status === 'DRAFT')
                },
                badge: { type: 'warning', label: 'Pendiente' }
            },
            {
                id: 'view-documents',
                label: 'Ver Documentos',
                icon: Eye,
                requiredPermissions: ['billing.view_invoice'],
                checkAvailability: (order) => order.invoices?.length > 0
            }
        ]
    },

    deliveries: {
        id: 'deliveries',
        label: 'Despachos',
        icon: Truck,
        actions: [
            {
                id: 'register-delivery',
                label: 'Registrar Despacho',
                icon: Package,
                requiredPermissions: ['inventory.add_stockmove'],
                excludedStatus: ['CANCELLED'],
                checkAvailability: (order) => {
                    // Show if not fully delivered
                    return order.delivery_status !== 'DELIVERED'
                },
                badge: { type: 'pending' }
            },
            {
                id: 'view-deliveries',
                label: 'Ver Despachos',
                icon: Eye,
                requiredPermissions: ['inventory.view_stockmove'],
                checkAvailability: (order) => {
                    return (order.related_documents?.deliveries?.length || 0) > 0
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
                checkAvailability: (order) => {
                    // Show if there's a posted invoice with pending amount
                    const hasPostedInvoice = order.invoices?.some((inv: any) => inv.status === 'POSTED')
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
            }
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
                    const hasValidInvoice = order.invoices?.some((inv: any) =>
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
                    return order.invoices?.some((inv: any) =>
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
                    // Show only if there's a draft invoice
                    return order.invoices?.some((inv: any) => inv.status === 'DRAFT')
                },
                variant: 'destructive'
            }
        ]
    }
}
