'use client'

import React from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer, X, Pencil, FileText } from 'lucide-react'
import { useSaleOrder } from '@/features/sales/hooks/useSalesOrders'
import { useReactToPrint } from 'react-to-print'
import { useRef } from 'react'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface SaleOrderDrawerProps extends TransactionDrawerProps {
    orderId?: number
}

export function SaleOrderDrawer({ id, open, onOpenChange, mode = 'view', orderId }: SaleOrderDrawerProps) {
    const entityId = id ?? orderId ?? null
    const { data: order, isLoading } = useSaleOrder(entityId)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const isEditable = mode === 'edit' && order?.status === 'DRAFT'

    return (
        <>
            <PrintableLayout
                ref={printRef}
                title="Comprobante de Venta"
                displayId={order?.number ?? `#${entityId}`}
                subtitle={order?.customer_name}
            >
                {order?.lines?.map((line, idx) => (
                    <div key={line.id ?? idx} className="flex justify-between text-[10px]">
                        <span className="flex-1">{line.description || line.product_name}</span>
                        <span className="w-12 text-right">{Math.round(Number(line.quantity))}</span>
                        <span className="w-16 text-right">{formatCurrency(Number(line.unit_price))}</span>
                    </div>
                ))}
                {order?.total && (
                    <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
                        <span>Total</span>
                        <span>{formatCurrency(Number(order.total))}</span>
                    </div>
                )}
            </PrintableLayout>

            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize="50%"
                icon={FileText}
                title={order?.number ?? 'Nota de Venta'}
                subtitle={order?.customer_name}
                description={`${formatPlainDate(order?.date)} · ${order?.channel_display ?? ''}`}
                headerActions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                }
            >
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando nota de venta">
                    {order && (
                        <div className="p-4 space-y-4">
                            <StatusBadge status={order.status} />

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground">Total</span>
                                    <p className="font-bold text-lg">{formatCurrency(Number(order.total))}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Pagado</span>
                                    <p className="font-bold text-lg">{formatCurrency(Number(order.total_paid))}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Pendiente</span>
                                    <p className="font-bold text-lg">{formatCurrency(Number(order.pending_amount))}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Estado Entrega</span>
                                    <StatusBadge status={order.delivery_status} />
                                </div>
                            </div>

                            {order.lines && order.lines.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold mb-2">Líneas</h4>
                                    <div className="space-y-2">
                                        {order.lines.map((line, idx) => (
                                            <div key={line.id ?? idx} className="flex justify-between text-sm border-b pb-1">
                                                <span>{line.description || line.product_name}</span>
                                                <span className="font-mono">
                                                    {Math.round(Number(line.quantity))} × {formatCurrency(Number(line.unit_price))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isEditable && (
                                <div className="flex justify-end pt-4">
                                    <Button>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </SkeletonShell>
            </Drawer>
        </>
    )
}
