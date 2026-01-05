import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash, Package, Eye, ArrowLeft, Building2, User, Paperclip, History, Plus, Save, Edit, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { translateStatus, translatePaymentMethod } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PaymentForm } from "@/components/forms/PaymentForm"

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
    const [editingPayment, setEditingPayment] = useState<any>(null)

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
        try {
            setLoading(true)

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

    const handleDeletePayment = async (payId: number) => {
        if (!confirm("¿Está seguro de eliminar este pago?")) return
        try {
            await api.delete(`/treasury/payments/${payId}/`)
            toast.success("Pago eliminado correctamente")
            fetchData()
        } catch (error) {
            console.error("Error deleting payment:", error)
            toast.error("Error al eliminar el pago")
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
        if (!data) return "DETALLE DE TRANSACCIÓN"
        if (view === 'history') return "HISTORIAL DE PAGOS"

        switch (currentType) {
            case 'sale_order':
                return `ORDEN DE VENTA NV-${data.number || data.id}`
            case 'purchase_order':
                return `ORDEN DE COMPRA OC-${data.number || data.id}`
            case 'invoice':
                const typeLabel = data.dte_type === 'NOTA_CREDITO' ? 'NOTA DE CRÉDITO' :
                    data.dte_type === 'NOTA_DEBITO' ? 'NOTA DE DÉBITO' :
                        data.dte_type === 'BOLETA' ? 'BOLETA' : 'FACTURA'
                const prefix = data.dte_type === 'NOTA_CREDITO' ? 'NC' :
                    data.dte_type === 'NOTA_DEBITO' ? 'ND' :
                        data.dte_type === 'BOLETA' ? 'BOL' : 'FACT'
                return `${typeLabel} ${prefix}-${data.number || data.id}`
            case 'payment':
                const payPrefix = data.payment_type === 'INBOUND' ? 'COMPROBANTE DE INGRESO' : 'COMPROBANTE DE EGRESO'
                return `${payPrefix} ${data.code || data.id}`
            case 'journal_entry':
                return `ASIENTO CONTABLE AS-${data.number || data.id}`
            case 'inventory':
                return `MOVIMIENTO DE INVENTARIO ${data.reference_code || `MOV-${data.id}`}`
            default:
                return "DETALLES DE TRANSACCIÓN"
        }
    }

    const getIcon = () => {
        if (view === 'history') return <History className="h-5 w-5 text-emerald-600" />
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
            <DialogContent className={`${currentType === 'journal_entry' ? 'max-w-5xl' : 'max-w-4xl'} max-h-[90vh] overflow-y-auto`}>
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
                            {data?.document_attachment && view !== 'history' && (
                                <a
                                    href={data.document_attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-muted-foreground hover:text-primary transition-colors"
                                    title="Ver adjunto"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </a>
                            )}
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
                        {(view === 'all' || view === 'details' || view === 'history') && (
                            <div className="space-y-4">
                                {currentType === 'payment' && (
                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/20">
                                        <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-black/5">
                                            <User className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black tracking-tight">{data.partner_name || '-'}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none">
                                                {data.payment_type === 'INBOUND' ? 'Cliente' : 'Proveedor'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className={`grid grid-cols-2 ${currentType === 'payment' ? 'lg:grid-cols-4' : 'md:grid-cols-4'} gap-4`}>
                                    {currentType === 'payment' ? (
                                        <>
                                            {/* 1. Caja / Banco */}
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-3">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-black mb-1">Caja / Banco</div>
                                                    <div className="font-bold flex items-center gap-1.5">
                                                        {data.treasury_account_type === 'BANK' ? <Building2 className="h-3.5 w-3.5 text-blue-500" /> : <Banknote className="h-3.5 w-3.5 text-green-500" />}
                                                        <span className="truncate text-xs">{data.journal_name}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            {/* 2. Método de Pago */}
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-3">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-black mb-1">Método de Pago</div>
                                                    <div className="font-bold text-xs truncate uppercase">
                                                        {data.payment_method_display || data.payment_method || '-'}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            {/* 3. N° Transacción */}
                                            <Card className="border-none shadow-sm bg-muted/30 relative group">
                                                <CardContent className="p-3">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-black mb-1">N° de Transacción</div>
                                                    <div className="font-bold text-xs font-mono flex items-center gap-2">
                                                        <span className={data.transaction_number ? "" : "text-muted-foreground italic font-normal"}>
                                                            {data.transaction_number || 'No registrado'}
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            {/* 4. Monto */}
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-3">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-black mb-1">Monto</div>
                                                    <div className={`font-black text-sm ${data.payment_type === 'INBOUND' ? 'text-green-600' : 'text-red-700'}`}>
                                                        ${Number(data.amount).toLocaleString()}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </>
                                    ) : (
                                        <>
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-4">
                                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                                        {currentType === 'inventory' ? 'Tipo Mov.' :
                                                            (currentType === 'purchase_order' ? 'Proveedor' :
                                                                (currentType === 'journal_entry' ? 'Descripción' : 'Cliente'))}
                                                    </div>
                                                    <div className="font-bold text-base truncate">
                                                        {currentType === 'inventory' ? (
                                                            <Badge variant={data.move_type === 'IN' ? 'default' : data.move_type === 'OUT' ? 'destructive' : 'outline'} className="mt-1">
                                                                {data.move_type_display}
                                                            </Badge>
                                                        ) : (currentType === 'journal_entry' ? (data.description || data.reference || '-') :
                                                            (data.customer_name || data.supplier_name || data.partner_name || 'N/A'))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-4">
                                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                                        {currentType === 'inventory' ? 'Fecha Mov.' : 'Fecha'}
                                                    </div>
                                                    <div className="font-bold text-base truncate">
                                                        {new Date(data.date || data.created_at).toLocaleDateString()}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-4">
                                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                                        {currentType === 'inventory' ? 'Almacén' : 'Estado'}
                                                    </div>
                                                    <div className="font-bold text-base truncate">
                                                        {currentType === 'inventory' ? data.warehouse_name : (
                                                            <Badge variant={data.status === 'PAID' || data.state === 'POSTED' ? 'default' : 'secondary'} className="mt-1">
                                                                {translateStatus(data.status || data.state)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-none shadow-sm bg-muted/30">
                                                <CardContent className="p-4">
                                                    <div className="text-sm text-muted-foreground uppercase font-semibold text-[10px]">
                                                        {currentType === 'inventory' ? 'Cantidad' : 'Total'}
                                                    </div>
                                                    <div className={`font-bold text-base truncate ${currentType === 'inventory' ? (parseFloat(data.quantity) > 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                                                        {currentType === 'inventory' ? Math.round(Math.abs(parseFloat(data.quantity))) : `$${Number(currentType === 'journal_entry' ? (data.items || []).reduce((acc: number, i: any) => acc + Number(i.debit), 0) : data.total).toLocaleString()}`}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Main Content Area */}
                        {(view === 'all' || view === 'details') && (
                            <div className="space-y-4 pt-4">
                                {currentType === 'payment' ? (
                                    <div className="space-y-6">
                                        {data.notes && (
                                            <div className="pt-2 border-t mt-4">
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observaciones</h4>
                                                <p className="text-sm bg-muted p-4 rounded-xl border border-dashed italic">
                                                    {data.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : currentType === 'inventory' ? (
                                    <div className="grid grid-cols-2 gap-8 py-2 border-t pt-6">
                                        <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase">N° Comprobante / Guía</h4>
                                            <p className="text-sm font-bold font-mono text-blue-600">{data.reference || data.reference_code || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Producto</h4>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold">{data.product_name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{data.product_code}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Notas / Observaciones</h4>
                                                <p className="text-sm italic text-muted-foreground">{data.notes || data.observation || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pt-4 border-t">
                                        {currentType === 'journal_entry' ? (
                                            <>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Cuenta</TableHead>
                                                            <TableHead>Glosa</TableHead>
                                                            <TableHead className="text-right w-[120px]">Debe</TableHead>
                                                            <TableHead className="text-right w-[120px]">Haber</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {(data.items || []).map((item: any) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-[10px] font-mono">{item.account_code}</span>
                                                                        <span className="text-xs">{item.account_name}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-xs italic text-muted-foreground">{item.label}</TableCell>
                                                                <TableCell className="text-right text-sm">
                                                                    {Number(item.debit) > 0 ? `$${Number(item.debit).toLocaleString()}` : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm">
                                                                    {Number(item.credit) > 0 ? `$${Number(item.credit).toLocaleString()}` : '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>

                                                <div className="flex justify-end pt-4">
                                                    <div className="w-full max-w-md pt-2 border-t space-y-1">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Totales</span>
                                                            <div className="flex gap-12">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">Total Debe</span>
                                                                    <span className="font-bold text-base text-blue-600">
                                                                        ${(data.items || []).reduce((acc: number, i: any) => acc + Number(i.debit), 0).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">Total Haber</span>
                                                                    <span className="font-bold text-base text-emerald-600">
                                                                        ${(data.items || []).reduce((acc: number, i: any) => acc + Number(i.credit), 0).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
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
                                                        {(data.lines || data.items || []).map((item: any, idx: number) => (
                                                            <TableRow key={item.id || idx}>
                                                                <TableCell className="font-medium text-sm">
                                                                    <div className="flex flex-col">
                                                                        <span>{item.description || item.product_name}</span>
                                                                        <span className="text-[8px] text-muted-foreground font-mono uppercase">{item.product_code}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center text-sm">{Math.round(parseFloat(item.quantity || 0))}</TableCell>
                                                                <TableCell className="text-right text-sm">${Number(item.unit_price || item.unit_cost).toLocaleString()}</TableCell>
                                                                <TableCell className="text-right font-bold text-sm">${Number(item.subtotal).toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {(!data.lines && !data.items) && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground italic text-xs">No se encontraron líneas de detalle</TableCell>
                                                            </TableRow>
                                                        )}
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
                            </div>
                        )}

                        {/* Stock Movements / Receipts Section */}
                        {(view === 'all' || view === 'details') && (
                            <>
                                {/* Case 2: Invoice/Note Stock Moves */}
                                {currentType === 'invoice' && data.related_stock_moves?.length > 0 &&
                                    !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(data.dte_type) && (
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
                        {(view === 'all' || view === 'history') &&
                            (currentType === 'sale_order' || currentType === 'purchase_order' || currentType === 'invoice') && (
                                <div className="space-y-4 pt-6 border-t">
                                    <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-600">
                                        <Banknote className="h-5 w-5" />
                                        Historial de Pagos
                                    </h3>
                                    {(data.serialized_payments || data.payments_detail)?.length > 0 ? (
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
                                                                <div className="flex justify-end gap-1">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateTo('payment', pay.id)} title="Ver Detalle">
                                                                        <Eye className="h-4 w-4 text-blue-600" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPayment(pay)} title="Editar">
                                                                        <Edit className="h-4 w-4 text-amber-600" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeletePayment(pay.id)} title="Eliminar">
                                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="border border-dashed p-10 text-center rounded-2xl bg-muted/20">
                                            <Banknote className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                                            <p className="text-muted-foreground text-sm italic">No se registran pagos para este documento</p>
                                        </div>
                                    )}
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

            {editingPayment && (
                <PaymentForm
                    open={!!editingPayment}
                    onOpenChange={(open) => !open && setEditingPayment(null)}
                    initialData={editingPayment}
                    onSuccess={() => {
                        setEditingPayment(null)
                        fetchData()
                    }}
                />
            )}
        </Dialog>
    )
}

