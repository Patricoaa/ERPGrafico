'use client'

import { useState, useEffect } from 'react'
import { CollapsibleSheet, PanelHeader } from '@/components/shared'
import { Zap } from 'lucide-react'
import { formatEntityDisplay } from '@/lib/entity-registry'
import { Chip } from '@/components/shared'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton, CardSkeleton, StatusBadge, EmptyState, } from '@/components/shared'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { ActionCategory } from './ActionCategory'
import { filterAvailableActions } from '@/lib/action-utils'
import { formatPlainDate } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { saleOrderActions } from '@/features/sales/actions'
import { ordersApi } from '../hooks/useOrdersMutations'
import type { UserPermissions } from '@/types/actions'
import { Order } from '../types'

interface OrderActionPanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: string | number
    orderType: 'purchase' | 'sale'
    onActionComplete?: () => void
}

export function OrderActionPanel({
    open,
    onOpenChange,
    orderId,
    orderType,
    onActionComplete
}: OrderActionPanelProps) {
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)

    const actionRegistry = orderType === 'purchase'
        ? purchaseOrderActions
        : saleOrderActions

    const fetchOrderDetails = async () => {
        setLoading(true)
        try {
            const data = orderType === 'purchase'
                ? await ordersApi.getPurchaseOrder(orderId)
                : await ordersApi.getSaleOrder(orderId)
            setOrder(data as Order)
        } catch (error) {
            console.error('Error fetching order:', error)
            toast.error('Error al cargar los detalles de la orden')
        } finally {
            setLoading(false)
        }
    }

    const fetchUserPermissions = async () => {
        try {
            const data = await ordersApi.getCurrentUser()
            setUserPermissions({
                permissions: (data as { permissions?: string[] }).permissions || [],
                isSuperuser: (data as { is_superuser?: boolean }).is_superuser || false
            })
        } catch (error) {
            console.error('Error fetching user permissions:', error)
            setUserPermissions({ permissions: [], isSuperuser: false })
        }
    }

    useEffect(() => {
        if (open && orderId) {
            requestAnimationFrame(() => {
                fetchOrderDetails()
                fetchUserPermissions()
            })
        }
    }, [open, orderId])

    const filteredActions = order && userPermissions
        ? filterAvailableActions(actionRegistry, order, userPermissions)
        : {}

    const handleActionComplete = () => {
        fetchOrderDetails()
        onActionComplete?.()
    }

    // Calculate payment progress
    const getPaymentProgress = () => {
        if (!order) return { percentage: 0, paid: 0, pending: 0 }

        const total = parseFloat(String(order.total || 0))
        const pending = order.pending_amount ?? total
        const paid = total - pending
        const percentage = total > 0 ? Math.round((paid / total) * 100) : 0

        return { percentage, paid, pending }
    }

    const paymentProgress = getPaymentProgress()

    return (
        <CollapsibleSheet
            sheetId={`ACTION_PANEL_${orderId}`}
            open={open}
            onOpenChange={onOpenChange}
            tabLabel="Acciones"
            tabIcon={Zap}
            size="md"
        >
            <div className="flex flex-col h-full">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b">
                    <PanelHeader
                        title={loading ? (
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-7 w-32 font-mono" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-mono">
                                    {formatEntityDisplay(orderType === 'purchase' ? 'purchasing.purchaseorder' : 'sales.saleorder', order)}
                                </span>
                                <StatusBadge status={order?.status || ""} />
                            </div>
                        )}
                        description={loading ? (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <span className="text-base font-medium text-foreground">
                                    {orderType === 'purchase' ? order?.supplier?.name : order?.customer?.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatPlainDate(order?.date)}
                                </span>
                            </div>
                        )}
                        onClose={() => onOpenChange(false)}
                        closeTooltip="Cerrar panel de acciones"
                    />
                </div>

                <ScrollArea className="flex-1 px-6 ">
                    {loading ? (
                        <div className="py-6">
                            <CardSkeleton count={3} variant="list" />
                        </div>
                    ) : (
                        <div className="space-y-6 py-6">
                            {/* Order Summary Card */}
                            <div className="bg-muted/50 rounded-md p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    Resumen de Orden
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Total Amount */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">Total</span>
                                        <div className="text-lg font-bold">
                                            {formatCurrency(order?.total || 0)}
                                        </div>
                                    </div>

                                    {/* Reception/Delivery Status */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">
                                            {orderType === 'purchase' ? 'Recepción' : 'Despacho'}
                                        </span>
                                        <StatusBadge
                                            status={
                                                orderType === 'purchase'
                                                    ? (order?.receiving_status || "")
                                                    : (order?.delivery_status || "")
                                            }
                                        />
                                    </div>
                                </div>

                                {/* Payment Progress */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Estado de Pago</span>
                                        <span className="text-xs font-bold">
                                            {paymentProgress.percentage}%
                                        </span>
                                    </div>
                                    <Progress value={paymentProgress.percentage} className="h-2" />
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Pagado: {formatCurrency(paymentProgress.paid)}
                                        </span>
                                        {paymentProgress.pending > 0 && (
                                            <span className="text-warning font-medium">
                                                Pendiente: {formatCurrency(paymentProgress.pending)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Document Count */}
                                {((order?.related_documents?.invoices || order?.invoices)?.length || 0) > 0 && (
                                    <div className="pt-2 border-t border-border/50">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Documentos</span>
                                            <Chip.Count value={(order?.related_documents?.invoices || order?.invoices)?.length || 0} hideOnZero={false} intent="neutral" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Action Categories */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    Acciones Disponibles
                                </h3>

                                {Object.entries(filteredActions).map(([key, category]) => (
                                    <ActionCategory
                                        key={key}
                                        category={category}
                                        order={order!}
                                        userPermissions={userPermissions?.permissions || []}
                                        onActionSuccess={handleActionComplete}
                                    />
                                ))}

                                 {Object.keys(filteredActions).length === 0 && (
                                     <EmptyState 
                                         context="generic" 
                                         title="Sin acciones disponibles" 
                                         description="Verifica el estado de la orden o tus permisos"
                                     />
                                 )}
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </div>
        </CollapsibleSheet>
    )
}
