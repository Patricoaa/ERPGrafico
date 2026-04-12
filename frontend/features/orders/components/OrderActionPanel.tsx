'use client'

import { useState, useEffect } from 'react'
import {
    Sheet,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { CollapsibleSheet } from '@/components/shared/CollapsibleSheet'
import { Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import api from '@/lib/api'
import { toast } from 'sonner'
import { ActionCategory } from './ActionCategory'
import { filterAvailableActions, getStatusVariant, getStatusLabel } from '@/lib/actions/utils'
import { formatPlainDate } from '@/lib/utils'
import { purchaseOrderActions } from '@/lib/actions/purchase-actions'
import { saleOrderActions } from '@/lib/actions/sale-actions'
import type { UserPermissions } from '@/types/actions'

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
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)

    const actionRegistry = orderType === 'purchase'
        ? purchaseOrderActions
        : saleOrderActions

    useEffect(() => {
        if (open && orderId) {
            fetchOrderDetails()
            fetchUserPermissions()
        }
    }, [open, orderId])

    const fetchOrderDetails = async () => {
        setLoading(true)
        try {
            const endpoint = orderType === 'purchase'
                ? `/purchasing/orders/${orderId}/`
                : `/sales/orders/${orderId}/`
            const res = await api.get(endpoint)
            setOrder(res.data)
        } catch (error) {
            console.error('Error fetching order:', error)
            toast.error('Error al cargar los detalles de la orden')
        } finally {
            setLoading(false)
        }
    }

    const fetchUserPermissions = async () => {
        try {
            const res = await api.get('/auth/user/')
            setUserPermissions({
                permissions: res.data.permissions || [],
                isSuperuser: res.data.is_superuser || false
            })
        } catch (error) {
            console.error('Error fetching user permissions:', error)
            // Fallback: assume no permissions
            setUserPermissions({ permissions: [], isSuperuser: false })
        }
    }

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

        const total = parseFloat(order.total || 0)
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
                <SheetHeader className="px-6 pt-6 pb-4">
                    <SheetTitle className="text-xl">
                        {loading ? (
                            <Skeleton className="h-7 w-48" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-mono">
                                    {orderType === 'purchase' ? 'OC' : 'NV'}-{order?.number}
                                </span>
                                <Badge variant={getStatusVariant(order?.status)}>
                                    {getStatusLabel(order?.status)}
                                </Badge>
                            </div>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        {loading ? (
                            <Skeleton className="h-4 w-64" />
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
                    </SheetDescription>
                </SheetHeader>

                <Separator />

                <ScrollArea className="flex-1 px-6">
                    {loading ? (
                        <div className="space-y-4 py-6">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-32 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6 py-6">
                            {/* Order Summary Card */}
                            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    Resumen de Orden
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Total Amount */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">Total</span>
                                        <div className="text-lg font-bold">
                                            ${Number(order?.total || 0).toLocaleString('es-CL')}
                                        </div>
                                    </div>

                                    {/* Reception/Delivery Status */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">
                                            {orderType === 'purchase' ? 'Recepción' : 'Despacho'}
                                        </span>
                                        <Badge
                                            variant={getStatusVariant(
                                                orderType === 'purchase'
                                                    ? order?.receiving_status
                                                    : order?.delivery_status
                                            )}
                                            className="text-xs"
                                        >
                                            {getStatusLabel(
                                                orderType === 'purchase'
                                                    ? order?.receiving_status
                                                    : order?.delivery_status
                                            )}
                                        </Badge>
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
                                            Pagado: ${paymentProgress.paid.toLocaleString('es-CL')}
                                        </span>
                                        {paymentProgress.pending > 0 && (
                                            <span className="text-warning font-medium">
                                                Pendiente: ${paymentProgress.pending.toLocaleString('es-CL')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Document Count */}
                                {((order?.related_documents?.invoices || order?.invoices)?.length || 0) > 0 && (
                                    <div className="pt-2 border-t border-border/50">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Documentos</span>
                                            <Badge variant="outline" className="text-xs">
                                                {(order.related_documents?.invoices || order.invoices)?.length}
                                            </Badge>
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
                                        order={order}
                                        userPermissions={userPermissions?.permissions || []}
                                        onActionSuccess={handleActionComplete}
                                    />
                                ))}

                                {Object.keys(filteredActions).length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <p className="text-sm">No hay acciones disponibles para esta orden</p>
                                        <p className="text-xs mt-1">
                                            Verifica el estado de la orden o tus permisos
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </ScrollArea>
                </div>
            </CollapsibleSheet>
    )
}
