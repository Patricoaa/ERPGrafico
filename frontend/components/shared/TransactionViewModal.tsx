import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash, Package, Eye, ArrowLeft, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { translateStatus, translatePaymentMethod } from "@/lib/utils"

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'journal_entry' | 'inventory'
    id: number | string
    view?: 'details' | 'history' | 'all'
}

export function TransactionViewModal({ open, onOpenChange, type: initialType, id: initialId, view = 'all' }: TransactionViewModalProps) {
    const [history, setHistory] = useState<{ type: string, id: number | string }[]>([])
    const [currentType, setCurrentType] = useState<any>(initialType)
    const [currentId, setCurrentId] = useState<number | string>(initialId)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setCurrentType(initialType)
            setCurrentId(initialId)
            setHistory([])
        }
    }, [open, initialType, initialId])

    useEffect(() => {
        if (open && currentId) {
            fetchData()
        }
    }, [open, currentId, currentType])

    const fetchData = async () => {
        setLoading(true)
        try {
            let endpoint = ""
            if (currentType === 'sale_order') endpoint = `/sales/orders/${currentId}/`
            else if (currentType === 'purchase_order') endpoint = `/purchasing/orders/${currentId}/`
            else if (currentType === 'invoice') endpoint = `/billing/invoices/${currentId}/`
            else if (currentType === 'payment') endpoint = `/treasury/payments/${currentId}/`
            else if (currentType === 'journal_entry') endpoint = `/accounting/entries/${currentId}/`
            else if (currentType === 'inventory') endpoint = `/inventory/moves/${currentId}/`

            const response = await api.get(endpoint)
            setData(response.data)
        } catch (error) {
            console.error("Error fetching transaction details:", error)
        } finally {
            setLoading(false)
        }
    }

    const navigateTo = (newType: string, newId: number | string) => {
        setHistory(prev => [...prev, { type: currentType, id: currentId }])
        setCurrentType(newType)
        setCurrentId(newId)
    }

    const goBack = () => {
        if (history.length === 0) return
        const prev = history[history.length - 1]
        setHistory(prev => prev.slice(0, -1))
        setCurrentType(prev.type)
        setCurrentId(prev.id)
    }

    const getTitle = () => {
        if (currentType === 'sale_order') return `Nota de Venta ${data?.number || ''}`
        if (currentType === 'purchase_order') return `Orden de Compra ${data?.number || ''}`
        if (currentType === 'invoice') return `${data?.dte_type_display || 'Factura'} ${data?.number || ''}`
        if (currentType === 'payment') return `Detalle de Movimiento: ${data?.code || data?.id || ''}`
        if (currentType === 'journal_entry') return `Asiento Contable ${data?.number || data?.id || ''}`
        if (currentType === 'inventory') return `Movimiento de Inventario #${data?.id || ''}`
        return "Detalles de Transacción"
    }

    const getIcon = () => {
        if (currentType === 'sale_order') return <ShoppingBag className="h-5 w-5" />
        if (currentType === 'purchase_order') return <FileText className="h-5 w-5" />
        if (currentType === 'invoice') return <Receipt className="h-5 w-5" />
        if (currentType === 'journal_entry') return <Hash className="h-5 w-5" />
        if (currentType === 'inventory') return <Package className="h-5 w-5 text-blue-600" />
        if (currentType === 'payment') return <Banknote className="h-5 w-5 text-emerald-600" />
        return <FileText className="h-5 w-5" />
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                            {getIcon()}
                            {getTitle()}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : data ? (
                    <div className="space-y-6 py-4">
                        {/* Summary Cards */}
                        {(view === 'all' || view === 'details') && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                            {currentType === 'purchase_order' ? 'Proveedor' :
                                                currentType === 'inventory' ? 'Producto' :
                                                    (currentType === 'journal_entry' ? 'Referencia' :
                                                        currentType === 'payment' ? 'Referencia' : 'Cliente')}
                                        </div>
                                        <div className="font-bold text-base truncate">
                                            {currentType === 'journal_entry' ? (data.reference || '-') :
                                                currentType === 'payment' ? (data.reference || '-') :
                                                    currentType === 'inventory' ? data.product_name :
                                                        (data.customer_name || data.supplier_name || data.partner_name || 'N/A')}
                                        </div>
                                        {currentType === 'inventory' && <div className="text-[10px] text-muted-foreground font-mono">{data.product_code}</div>}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                            {currentType === 'inventory' ? 'Almacén' :
                                                currentType === 'payment' ? 'Cliente / Proveedor' : 'Fecha'}
                                        </div>
                                        <div className="font-bold text-base truncate">
                                            {currentType === 'inventory' ? data.warehouse_name :
                                                currentType === 'payment' ? data.partner_name :
                                                    new Date(data.date || data.created_at).toLocaleDateString()}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                            {currentType === 'inventory' ? 'Fecha Mov.' :
                                                currentType === 'payment' ? 'Caja / Banco' : 'Estado'}
                                        </div>
                                        <div className="font-bold text-base">
                                            {currentType === 'inventory' ? new Date(data.date).toLocaleDateString() :
                                                currentType === 'payment' ? (
                                                    <div className="flex items-center gap-1">
                                                        {data.treasury_account_type === 'BANK' ? <Building2 className="h-4 w-4 text-blue-500" /> : <Banknote className="h-4 w-4 text-green-500" />}
                                                        <span className="truncate">{data.journal_name}</span>
                                                    </div>
                                                ) : (
                                                    <Badge variant={data.status === 'PAID' || data.state === 'POSTED' ? 'default' : 'secondary'} className="mt-1">
                                                        {translateStatus(data.status || data.state)}
                                                    </Badge>
                                                )}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                            {currentType === 'inventory' ? 'Tipo Mov.' :
                                                currentType === 'payment' ? 'Tipo' : 'Total'}
                                        </div>
                                        <div className="font-bold text-base">
                                            {currentType === 'inventory' ? (
                                                <Badge variant={data.move_type === 'IN' ? 'default' : data.move_type === 'OUT' ? 'destructive' : 'outline'}>
                                                    {data.move_type_display}
                                                </Badge>
                                            ) : currentType === 'payment' ? (
                                                <Badge variant={data.payment_type === 'INBOUND' ? 'default' : 'destructive'}>
                                                    {data.payment_type === 'INBOUND' ? 'Ingreso' : 'Egreso'}
                                                </Badge>
                                            ) : `$${Number(data.total).toLocaleString()}`}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Main Content Area */}
                        {(view === 'all' || view === 'details') && (
                            <div className="space-y-4">
                                {currentType === 'payment' ? (
                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Monto de la Operación</h4>
                                                    <p className={`text-3xl font-black ${data.payment_type === 'INBOUND' ? 'text-green-600' : 'text-red-600'}`}>
                                                        ${Number(data.amount).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase italic pb-1">Método de Pago</h4>
                                                    <Badge variant="outline" className="font-mono">{data.payment_method_display || data.payment_method || '-'}</Badge>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Documentos Asociados</h4>
                                                    <div className="space-y-2 pt-1">
                                                        {data.document_info ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full justify-start text-blue-600"
                                                                onClick={() => navigateTo(data.document_info.type, data.document_info.id)}
                                                            >
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                {data.document_info.label}
                                                            </Button>
                                                        ) : <span className="text-sm text-muted-foreground">Sin documento asociado</span>}

                                                        {data.journal_entry && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start text-muted-foreground italic text-[10px]"
                                                                onClick={() => navigateTo('journal_entry', data.journal_entry)}
                                                            >
                                                                <Hash className="h-3 w-3 mr-2" />
                                                                Ver Movimiento Contable
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {data.notes && (
                                            <div className="pt-2">
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observaciones</h4>
                                                <p className="text-sm bg-muted p-3 rounded-md italic">{data.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : currentType === 'inventory' ? (
                                    <div className="grid grid-cols-2 gap-8 py-2">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Descripción</h4>
                                                <p className="text-sm font-medium">{data.description || 'Sin descripción'}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Cantidad</h4>
                                                <p className={`text-xl font-bold ${parseFloat(data.quantity) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {data.quantity}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Documento Contable</h4>
                                                {data.journal_entry ? (
                                                    <button
                                                        onClick={() => navigateTo('journal_entry', data.journal_entry)}
                                                        className="text-sm font-bold text-blue-600 hover:underline"
                                                    >
                                                        Asiento {data.journal_entry_number || data.journal_entry}
                                                    </button>
                                                ) : <span className="text-sm text-muted-foreground">No asociado</span>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                                        <TableCell className="text-right">${Number(item.unit_price || item.unit_cost).toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-bold">${Number(item.subtotal).toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>

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
                                    </>
                                )}
                            </div>
                        )}

                        {/* Stock Movements / Receipts Section */}
                        {(view === 'all' || view === 'details') && (
                            <>
                                {/* Case 1: Purchase Order Receipts */}
                                {currentType === 'purchase_order' && data.related_documents?.receipts?.length > 0 && (
                                    <div className="space-y-4 pt-6 border-t">
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <Package className="h-5 w-5 text-blue-600" />
                                            Recepciones de Mercadería
                                        </h3>
                                        <div className="space-y-4">
                                            {data.related_documents.receipts.map((receipt: any) => (
                                                <div key={receipt.id} className="border rounded-md overflow-hidden">
                                                    <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-sm border-b">
                                                        <span className="font-bold">Recepción: {receipt.number}</span>
                                                        <span className="text-muted-foreground">{new Date(receipt.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="p-0">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="h-8">Producto</TableHead>
                                                                    <TableHead className="h-8 text-center">Cantidad</TableHead>
                                                                    <TableHead className="h-8 text-right">Acción</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {receipt.stock_moves?.map((move: any) => (
                                                                    <TableRow key={move.id}>
                                                                        <TableCell className="py-2 text-sm">{move.product}</TableCell>
                                                                        <TableCell className="py-2 text-center text-sm font-bold">
                                                                            <span className={move.is_return ? "text-red-600" : "text-green-600"}>
                                                                                {move.quantity}
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 text-right">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 text-[10px] text-blue-600"
                                                                                onClick={() => navigateTo('inventory', move.id)}
                                                                            >
                                                                                <Eye className="h-3 w-3 mr-1" />
                                                                                Ver
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Case 2: Invoice/Note Stock Moves */}
                                {currentType === 'invoice' && data.related_stock_moves?.length > 0 && (
                                    <div className="space-y-4 pt-6 border-t">
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <Package className="h-5 w-5 text-orange-600" />
                                            Movimientos de Stock
                                        </h3>
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead>Almacén</TableHead>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead className="text-center">Tipo</TableHead>
                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                        <TableHead className="text-right">Acción</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {data.related_stock_moves.map((move: any) => (
                                                        <TableRow key={move.id}>
                                                            <TableCell>{new Date(move.date).toLocaleDateString()}</TableCell>
                                                            <TableCell className="text-xs">{move.warehouse}</TableCell>
                                                            <TableCell className="font-medium">{move.product}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {move.move_type_display}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold">
                                                                <span className={move.quantity > 0 ? "text-green-600" : "text-red-600"}>
                                                                    {move.quantity}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => navigateTo('inventory', move.id)}
                                                                >
                                                                    <Eye className="h-3 w-3 text-blue-600" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Payment History Section */}
                        {(view === 'all' || view === 'history') && (currentType === 'sale_order' || currentType === 'purchase_order' || currentType === 'invoice') && (data.serialized_payments || data.payments_detail)?.length > 0 && (
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
                                                <TableHead className="text-right">Acción</TableHead>
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
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => navigateTo('payment', pay.id)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {(view === 'all' || view === 'details') && data.notes && currentType !== 'payment' && (
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

