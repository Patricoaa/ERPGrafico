"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash } from "lucide-react"

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'sale_order' | 'purchase_order' | 'invoice' | 'payment'
    id: number | string
}

export function TransactionViewModal({ open, onOpenChange, type, id }: TransactionViewModalProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && id) {
            fetchData()
        }
    }, [open, id, type])

    const fetchData = async () => {
        setLoading(true)
        try {
            let endpoint = ""
            if (type === 'sale_order') endpoint = `/sales/orders/${id}/`
            else if (type === 'purchase_order') endpoint = `/purchasing/orders/${id}/`
            else if (type === 'invoice') endpoint = `/billing/invoices/${id}/`
            else if (type === 'payment') endpoint = `/treasury/payments/${id}/`

            const response = await api.get(endpoint)
            setData(response.data)
        } catch (error) {
            console.error("Error fetching transaction details:", error)
        } finally {
            setLoading(false)
        }
    }

    const getTitle = () => {
        if (type === 'sale_order') return `Nota de Venta ${data?.number || ''}`
        if (type === 'purchase_order') return `Orden de Compra ${data?.number || ''}`
        if (type === 'invoice') return `${data?.dte_type_display || 'Factura'} ${data?.number || ''}`
        if (type === 'payment') return `Pago ${data?.id || ''}`
        return "Detalles de Transacción"
    }

    const getIcon = () => {
        if (type === 'sale_order') return <ShoppingBag className="h-5 w-5" />
        if (type === 'purchase_order') return <FileText className="h-5 w-5" />
        if (type === 'invoice') return <Receipt className="h-5 w-5" />
        return <FileText className="h-5 w-5" />
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                        {getIcon()}
                        {getTitle()}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : data ? (
                    <div className="space-y-6 py-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                        {type === 'purchase_order' ? 'Proveedor' : 'Cliente'}
                                    </div>
                                    <div className="font-bold text-lg">
                                        {data.customer_name || data.supplier_name || data.partner_name || 'N/A'}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">Fecha</div>
                                    <div className="font-bold text-lg">{new Date(data.date || data.created_at).toLocaleDateString()}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">Estado</div>
                                    <Badge variant={data.status === 'PAID' || data.state === 'POSTED' ? 'default' : 'secondary'} className="mt-1">
                                        {data.status || data.state}
                                    </Badge>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Line Items */}
                        <div className="space-y-2">
                            <h3 className="font-bold text-lg border-b pb-2">Detalles</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="text-center w-[100px]">Cant.</TableHead>
                                        <TableHead className="text-right w-[150px]">Precio Unit.</TableHead>
                                        <TableHead className="text-right w-[150px]">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(data.lines || data.items || []).map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.description || item.product_name}</TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-right">${Number(item.unit_price).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold">${Number(item.subtotal).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Totals Section */}
                        <div className="flex justify-end pt-4">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Neto</span>
                                    <span>${Number(data.total_net).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">IVA (19%)</span>
                                    <span>${Number(data.total_tax).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-xl border-t pt-2 mt-2">
                                    <span>Total</span>
                                    <span>${Number(data.total).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment History Section */}
                        {(type === 'sale_order' || type === 'purchase_order' || type === 'invoice') && (data.serialized_payments || data.payments_detail)?.length > 0 && (
                            <div className="space-y-4 pt-6 border-t">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Banknote className="h-5 w-5 text-emerald-600" />
                                    Historial de Pagos
                                </h3>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Método</TableHead>
                                                <TableHead>Referencia / Transacción</TableHead>
                                                <TableHead className="text-right">Monto</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(data.serialized_payments || data.payments_detail || []).map((pay: any) => (
                                                <TableRow key={pay.id}>
                                                    <TableCell>{new Date(pay.date || pay.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="uppercase text-[10px]">
                                                            {pay.payment_type === 'INBOUND' ? 'Cobro' : 'Pago'} ({pay.payment_method || pay.journal_name})
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-mono">
                                                        {pay.transaction_number ? (
                                                            <div className="flex flex-col">
                                                                <span>{pay.transaction_number}</span>
                                                                {pay.is_pending_registration && <span className="text-[9px] text-orange-500 font-bold uppercase">(Pendiente Registro)</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">{pay.reference || '-'}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-emerald-600">
                                                        ${Number(pay.amount).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {data.notes && (
                            <div className="pt-4 border-t">
                                <h4 className="text-sm font-semibold text-muted-foreground mb-1 uppercase">Notas</h4>
                                <p className="text-sm bg-muted p-4 rounded-md">{data.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-20 text-center text-muted-foreground">
                        No se pudo cargar la información.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
