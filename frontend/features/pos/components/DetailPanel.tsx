"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import { useSaleOrder } from "@/features/sales"
import { useInvoice } from "@/features/billing"

interface DetailPanelProps {
    type: string
    id: number
    onClose: () => void
}

function entityLabel(type: string): string {
    const labels: Record<string, string> = {
        sale_order: 'Orden de Venta',
        invoice: 'Factura / Documento',
        sale_delivery: 'Guía de Despacho',
        purchase_order: 'Orden de Compra',
        payment: 'Pago',
        purchase_receipt: 'Recepción',
        stock_move: 'Movimiento de Stock',
        journal_entry: 'Asiento Contable',
        cash_movement: 'Movimiento de Caja',
    }
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function DetailPanel({ type, id, onClose }: DetailPanelProps) {
    const saleOrder = useSaleOrder(type === 'sale_order' ? id : null)
    const invoice = useInvoice(type === 'invoice' ? id : null)

    const isLoading = saleOrder.isLoading || invoice.isLoading

    if (isLoading) {
        return (
            <div className="flex flex-col h-full animate-pulse">
                <Header onClose={onClose} />
                <div className="flex-1 p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-1/2 bg-muted rounded" />
                    <div className="h-20 w-full bg-muted/60 rounded" />
                    <div className="h-20 w-full bg-muted/40 rounded" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <Header onClose={onClose} label={entityLabel(type)} />
            <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                    {/* Sale Order Detail */}
                    {type === 'sale_order' && saleOrder.data && (
                        <SaleOrderDetail order={saleOrder.data} />
                    )}

                    {/* Invoice Detail */}
                    {type === 'invoice' && invoice.data && (
                        <InvoiceDetail invoice={invoice.data} />
                    )}

                    {/* Generic fallback */}
                    {!saleOrder.data && !invoice.data && (
                        <div className="text-sm text-muted-foreground p-4 text-center">
                            <p className="font-semibold text-foreground">{entityLabel(type)}</p>
                            <p className="text-xs mt-1">ID: {id}</p>
                            <p className="text-xs mt-2">Los detalles para este tipo de documento no están disponibles en esta vista.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

function Header({ onClose, label }: { onClose: () => void; label?: string }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                {label || 'Detalle'}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

function SaleOrderDetail({ order }: { order: NonNullable<ReturnType<typeof useSaleOrder>['data']> }) {
    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-bold">{order.number || `#${order.id}`}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                </div>
                <StatusBadge status={order.status} size="sm" />
            </div>

            <div className="text-[10px] text-muted-foreground space-y-0.5 border-b pb-2">
                <p>Fecha: {formatPlainDate(order.date)}</p>
                {order.pos_session_display && <p>Sesión: {order.pos_session_display}</p>}
                <p>Estado de despacho: {order.delivery_status || '-'}</p>
            </div>

            {order.lines && order.lines.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Productos</p>
                    {order.lines.slice(0, 10).map((line, idx) => (
                        <div key={idx} className="flex items-start justify-between text-[11px] gap-2 border-b border-border/30 pb-1 last:border-0">
                            <span className="flex-1 line-clamp-1">{line.product_name || line.description}</span>
                            <span className="shrink-0 text-right">
                                {Math.round(Number(line.quantity))} × {formatCurrency(Number(line.unit_price))}
                            </span>
                        </div>
                    ))}
                    {order.lines.length > 10 && (
                        <p className="text-[9px] text-muted-foreground italic">...y {order.lines.length - 10} productos más</p>
                    )}
                </div>
            )}

            <div className="border-t pt-2 space-y-0.5 text-xs">
                <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(Number(order.total))}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Pagado</span>
                    <span>{formatCurrency(Number(order.total_paid))}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Pendiente</span>
                    <span>{formatCurrency(Number(order.pending_amount))}</span>
                </div>
            </div>

            {order.related_documents && (
                <div className="border-t pt-2 text-[10px] text-muted-foreground space-y-0.5">
                    {order.related_documents.invoices?.length > 0 && (
                        <p>Documentos DTE: {order.related_documents.invoices.length}</p>
                    )}
                    {order.related_documents.deliveries?.length > 0 && (
                        <p>Despachos: {order.related_documents.deliveries.length}</p>
                    )}
                    {order.related_documents.payments?.length > 0 && (
                        <p>Pagos: {order.related_documents.payments.length}</p>
                    )}
                </div>
            )}
        </>
    )
}

function InvoiceDetail({ invoice }: { invoice: NonNullable<ReturnType<typeof useInvoice>['data']> }) {
    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-bold">{invoice.display_id || invoice.number || `#${invoice.id}`}</p>
                    <p className="text-xs text-muted-foreground">{invoice.partner_name}</p>
                </div>
                <StatusBadge status={invoice.status} size="sm" />
            </div>

            <div className="text-[10px] text-muted-foreground space-y-0.5 border-b pb-2">
                <p>Fecha: {formatPlainDate(invoice.date)}</p>
                <p>Tipo: {invoice.dte_type_display || invoice.dte_type}</p>
            </div>

            {invoice.lines && invoice.lines.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Líneas</p>
                    {invoice.lines.map((line, idx) => (
                        <div key={idx} className="flex items-start justify-between text-[11px] gap-2 border-b border-border/30 pb-1 last:border-0">
                            <span className="flex-1 line-clamp-1">{'product_name' in line ? (line as any).product_name : line.description || '-'}</span>
                            <span className="shrink-0 text-right">
                                {Math.round(Number(line.quantity))} × {formatCurrency(Number((line as any).unit_price || 0))}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t pt-2 flex justify-between font-bold text-xs">
                <span>Total</span>
                <span>{formatCurrency(Number(invoice.total))}</span>
            </div>

            {Number(invoice.pending_amount) > 0 && (
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Pendiente</span>
                    <span>{formatCurrency(Number(invoice.pending_amount))}</span>
                </div>
            )}
        </>
    )
}
