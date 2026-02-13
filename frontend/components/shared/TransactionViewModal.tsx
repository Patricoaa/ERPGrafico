"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash, Package, Eye, ArrowLeft, Building2, User, Paperclip, History, Plus, Save, Edit, X, Trash2, ClipboardList, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { translateStatus, translatePaymentMethod, translateReceivingStatus, formatCurrency, formatPlainDate } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { Progress } from "@/components/ui/progress"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { AttachmentList } from "./AttachmentList"

type EntityType = 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'cash_movement'

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'journal_entry' | 'inventory' | 'work_order' | 'sale_delivery' | 'purchase_receipt' | 'cash_movement'
    id: number | string
    view?: 'details' | 'history' | 'all'
}

// --- Helper Components for the Modular Layout ---

const BannerStatus = ({ status, type }: { status: string, type: string }) => {
    const variant = status === 'DELIVERED' || status === 'PAID' || status === 'COMPLETED' || status === 'RECEIVED' ? 'default' :
        status === 'PARTIAL' || status === 'READY' || status === 'APPROVED' ? 'secondary' : 'outline'

    return (
        <Badge variant={variant} className="font-bold text-xs px-3 py-1 uppercase tracking-wider">
            {translateStatus(status)}
        </Badge>
    )
}

const MetadataItem = ({ label, value, icon: Icon, className = "" }: { label: string, value: any, icon?: any, className?: string }) => {
    if (value === undefined || value === null || value === "") return null
    return (
        <div className={`space-y-1 ${className}`}>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                {Icon && <Icon className="h-3 w-3" />}
                {label}
            </h4>
            <div className="text-sm font-semibold truncate">
                {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
            </div>
        </div>
    )
}

const SidebarSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4 pt-4 first:pt-0">
        <h3 className="text-[11px] font-black text-primary/80 uppercase tracking-tighter border-b pb-2">{title}</h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
)

const SidebarContent = ({ data, currentType }: { data: any, currentType: string }) => {
    if (!data) return null

    return (
        <div className="space-y-8 divide-y divide-border/20">
            <SidebarSection title="Información Logística">
                <MetadataItem label="Almacén / Bodega" value={data.warehouse_name || data.warehouse} icon={Package} />
                <MetadataItem label="Estado de Despacho" value={data.delivery_status && translateReceivingStatus(data.delivery_status)} />
                <MetadataItem label="Vendedor" value={data.salesperson_name || data.seller_name} icon={User} />
                <MetadataItem label="Canal de Venta" value={data.channel === 'POS' ? 'Punto de Venta' : (data.channel || 'Sistema')} />
            </SidebarSection>

            <SidebarSection title="Fechas y Plazos">
                <MetadataItem label="Fecha Emisión" value={formatPlainDate(data.date || data.created_at)} />
                <MetadataItem label="Fecha Vencimiento" value={formatPlainDate(data.due_date)} />
                <MetadataItem label="Entrega Planificada" value={formatPlainDate(data.planned_delivery_date || data.planned_receipt_date)} />
            </SidebarSection>

            <SidebarSection title="Identificadores">
                <MetadataItem label="Referencia Externa" value={data.external_reference || data.supplier_reference} />
                <MetadataItem label="ID de Transacción" value={data.id} className="font-mono text-[11px]" />
                {data.pos_session && <MetadataItem label="Sesión POS" value={`#${data.pos_session}`} />}
            </SidebarSection>

            {data.attachments?.length > 0 && (
                <SidebarSection title="Archivos">
                    <AttachmentList attachments={data.attachments} />
                </SidebarSection>
            )}
        </div>
    )
}

const RelatedDocumentsSection = ({ data, currentType, navigateTo }: { data: any, currentType: string, navigateTo: any }) => {
    if (!data) return null;

    const renderCard = (type: string, id: any, title: string, subtitle: string, icon: any, color: string, colorBg: string, colorBorder: string) => (
        <Card className={`border-${colorBorder} bg-${colorBg}/30 hover:opacity-80 transition-all cursor-pointer shadow-sm`} onClick={() => navigateTo(type, id)}>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 bg-${colorBorder}/20 rounded-lg`}>
                        {icon}
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground uppercase font-black">{title}</div>
                        <div className={`font-black text-sm text-${color}-600`}>{subtitle}</div>
                    </div>
                    <Eye className={`h-4 w-4 text-${color}-600`} />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4 pt-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                <ArrowLeft className="h-5 w-5 rotate-180 text-primary" />
                Documentos Relacionados
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentType === 'invoice' && (
                    <>
                        {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta Origen', `NV-${data.sale_order_number || data.sale_order}`, <ShoppingBag className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                        {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra Origen', `OCS-${data.purchase_order_number || data.purchase_order}`, <FileText className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                        {data.corrected_invoice && renderCard('invoice', data.corrected_invoice, 'Documento Rectificado', data.corrected_invoice_display || `FACT-${data.corrected_invoice}`, <Receipt className="h-5 w-5 text-amber-600" />, 'amber', 'amber-50', 'amber-200')}
                    </>
                )}

                {currentType === 'sale_order' && (
                    <>
                        {data.invoices?.map((inv: any) => renderCard('invoice', inv.id, inv.dte_type_display || 'Factura', inv.display_id, <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200'))}
                        {data.deliveries?.map((del: any) => renderCard('sale_delivery', del.id, 'Despacho', del.display_id, <Package className="h-5 w-5 text-orange-600" />, 'orange', 'orange-50', 'orange-200'))}
                    </>
                )}

                {currentType === 'purchase_order' && (
                    <>
                        {data.work_order && renderCard('work_order', data.work_order, 'Orden de Trabajo Origen', `OT-${data.work_order_number || data.work_order}`, <ClipboardList className="h-5 w-5 text-indigo-600" />, 'indigo', 'indigo-50', 'indigo-200')}
                        {data.invoices?.map((inv: any) => renderCard('invoice', inv.id, inv.dte_type_display || 'Factura', inv.display_id, <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200'))}
                        {data.receipts?.map((rec: any) => renderCard('purchase_receipt', rec.id, 'Recepción', rec.display_id, <Package className="h-5 w-5 text-orange-600" />, 'orange', 'orange-50', 'orange-200'))}
                    </>
                )}

                {data.journal_entry && renderCard('journal_entry', data.journal_entry, 'Asiento Contable', `AS-${data.journal_entry_number || data.journal_entry}`, <Hash className="h-5 w-5 text-purple-600" />, 'purple', 'purple-50', 'purple-200')}
            </div>
        </div>
    );
}

const PaymentHistorySection = ({ data, currentType, navigateTo, handleDeletePayment }: { data: any, currentType: string, navigateTo: any, handleDeletePayment: any }) => {
    const payments = data?.serialized_payments || data?.payments_detail || [];
    if (payments.length === 0) return null;

    return (
        <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-emerald-600">
                <Banknote className="h-5 w-5" />
                Historial de Pagos
            </h3>
            <div className="border rounded-2xl overflow-hidden bg-background shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow className="hover:bg-transparent tracking-widest text-[10px] font-black uppercase">
                            <TableHead className="h-10">Fecha</TableHead>
                            <TableHead className="h-10">Método / Referencia</TableHead>
                            <TableHead className="text-right h-10 w-[140px]">Monto</TableHead>
                            <TableHead className="text-right h-10 w-[80px]">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((pay: any) => (
                            <TableRow key={pay.id} className="hover:bg-muted/10 transition-colors">
                                <TableCell className="text-xs font-semibold">{formatPlainDate(pay.date || pay.created_at)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase">{translatePaymentMethod(pay.payment_method || pay.journal_name)}</span>
                                        <span className="text-[9px] font-mono text-muted-foreground">{pay.transaction_number || pay.reference || '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-black text-sm text-emerald-600">
                                    {formatCurrency(pay.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 rounded-lg hover:bg-blue-50" onClick={() => navigateTo('payment', pay.id)}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
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
            console.log(`[TransactionViewModal] Initializing with type: ${initialType}, id: ${initialId}`)
            setCurrentType(initialType?.toLowerCase())
            setCurrentId(initialId)
            setHistory([])
            setData(null)
        }
    }, [open, initialType, initialId])

    useEffect(() => {
        if (open && currentId && currentId !== 0) {
            fetchData()
        }
    }, [open, currentId, currentType])

    const fetchData = async () => {
        if (!currentId || currentId === 0) return

        try {
            setLoading(true)
            setData(null)

            let endpoint = ""
            const type = currentType?.toLowerCase()

            if (type === 'sale_order') endpoint = `/sales/orders/${currentId}/`
            else if (type === 'purchase_order') endpoint = `/purchasing/orders/${currentId}/`
            else if (type === 'invoice') endpoint = `/billing/invoices/${currentId}/`
            else if (type === 'payment') endpoint = `/treasury/payments/${currentId}/`
            else if (type === 'journal_entry') endpoint = `/accounting/entries/${currentId}/`
            else if (type === 'inventory' || type === 'stock_move') endpoint = `/inventory/moves/${currentId}/`
            else if (type === 'work_order') endpoint = `/production/orders/${currentId}/`
            else if (type === 'sale_delivery') endpoint = `/sales/deliveries/${currentId}/`
            else if (type === 'purchase_receipt') endpoint = `/purchasing/receipts/${currentId}/`
            else if (type === 'sale_return') endpoint = `/sales/returns/${currentId}/`
            else if (type === 'purchase_return') endpoint = `/purchasing/returns/${currentId}/`
            else if (type === 'cash_movement') endpoint = `/treasury/cash-movements/${currentId}/`

            if (!endpoint) {
                console.error(`[TransactionViewModal] No endpoint mapping for type: ${type}`)
                setLoading(false)
                return
            }

            console.log(`[TransactionViewModal] Fetching from: ${endpoint}`)
            const response = await api.get(endpoint)
            setData(response.data)

        } catch (error: any) {
            console.error("Error fetching transaction details:", error)
            const msg = error.response?.data?.error || error.message || "Error desconocido"
            toast.error(`Error al cargar: ${msg}`)
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

    const getHeaderInfo = () => {
        if (!data) return { main: "DETALLE DE TRANSACCIÓN", sub: "" }
        if (view === 'history') return { main: "HISTORIAL DE PAGOS", sub: data.display_id || data.number || data.id }

        switch (currentType) {
            case 'sale_order':
                return { main: "Comprobante de Venta", sub: `NV-${data.number || data.id}` }
            case 'purchase_order':
                return { main: "Comprobante de Compra", sub: `OCS-${data.number || data.id}` }
            case 'invoice':
                const typeLabel = data.dte_type === 'NOTA_CREDITO' ? 'Nota de Crédito' :
                    data.dte_type === 'NOTA_DEBITO' ? 'Nota de Débito' :
                        data.dte_type === 'BOLETA' ? 'Boleta de Venta' :
                            data.dte_type === 'FACTURA_EXENTA' ? 'Factura Exenta' :
                                data.dte_type === 'BOLETA_EXENTA' ? 'Boleta Exenta' : 'Factura de Venta'
                const prefix = data.dte_type === 'NOTA_CREDITO' ? 'NC' :
                    data.dte_type === 'NOTA_DEBITO' ? 'ND' :
                        data.dte_type === 'BOLETA' ? 'BOL' :
                            data.dte_type === 'FACTURA_EXENTA' ? 'FE' :
                                data.dte_type === 'BOLETA_EXENTA' ? 'BE' : 'FACT'
                return { main: `Comprobante de ${typeLabel}`, sub: `${prefix}-${data.number || data.id}` }
            case 'payment':
                const payPrefix = data.payment_type === 'INBOUND' ? 'Comprobante de Ingreso' : 'Comprobante de Egreso'
                const payId = data.display_id || (data.payment_type === 'INBOUND' ? 'DEP-' : 'RET-') + data.id
                return { main: payPrefix, sub: payId }
            case 'journal_entry':
                return { main: "Asiento Contable", sub: `AS-${data.number || data.id}` }
            case 'inventory':
                return { main: "Movimiento de Inventario", sub: data.reference_code || `MOV-${data.id}` }
            case 'work_order':
                return { main: "Orden de Trabajo", sub: data.code || `OT-${data.id}` }
            case 'sale_delivery':
                return { main: "Despacho de Venta", sub: data.display_id || `DES-${data.number || data.id}` }
            case 'purchase_receipt':
                const isService = (data.lines || []).some((l: any) => l.product_type === 'SERVICE')
                return { main: isService ? "Entrega de Servicio" : "Recepción de Compra", sub: `REC-${data.id}` }
            case 'sale_return':
            case 'purchase_return':
                return { main: "Devolución de Mercadería", sub: data.display_id || `DEV-${data.number || data.id}` }
            case 'cash_movement':
                const moveType = data.movement_type === 'DEPOSIT' ? 'Depósito' :
                    data.movement_type === 'WITHDRAWAL' ? 'Retiro' : 'Traspaso'
                return { main: `${moveType} de Efectivo`, sub: `MOV-${data.id}` }
            default:
                return { main: "Detalles de Transacción", sub: "" }
        }
    }

    const { main: mainTitle, sub: subTitle } = getHeaderInfo()

    const mapToEntityType = (type: string): EntityType | null => {
        switch (type) {
            case 'sale_order': return 'sale_order'
            case 'purchase_order': return 'purchase_order'
            case 'invoice': return 'invoice'
            case 'payment': return 'payment'
            case 'sale_delivery': return 'sale_delivery'
            case 'purchase_receipt': return 'purchase_receipt'
            case 'work_order': return 'work_order'
            case 'journal_entry': return 'journal_entry'
            case 'inventory': return 'stock_move'
            case 'user': return 'user'
            default: return null
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
        if (currentType === 'work_order') return <ClipboardList className="h-5 w-5 text-indigo-600" />
        if (currentType === 'sale_delivery' || currentType === 'purchase_receipt') return <Package className="h-5 w-5 text-orange-600" />
        if (currentType === 'cash_movement') return <ArrowLeft className="h-5 w-5 text-blue-600" />
        return <FileText className="h-5 w-5" />
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title=""
                size="xl"
                hideScrollArea={true}
                className="overflow-hidden p-0 gap-0"
            >
                <div className="flex flex-col h-[90vh] md:h-[85vh] max-h-[900px] bg-background">
                    {/* Header Banner */}
                    <div className="bg-primary/[0.03] border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 relative">
                        {/* Back button and Basic Info */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                {history.length > 0 && (
                                    <Button variant="ghost" size="icon" onClick={goBack} className="h-9 w-9 rounded-full bg-background shadow-sm hover:bg-muted border border-border/50">
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                )}
                                <div className="p-3 bg-background rounded-2xl shadow-sm border border-primary/10">
                                    {getIcon()}
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black tracking-tight text-primary uppercase leading-none">{mainTitle}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-mono font-black text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-dashed uppercase tracking-wider">{subTitle}</span>
                                        {data?.reference && <span className="text-[10px] font-mono text-muted-foreground font-bold">Ref: {data.reference}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Totals & Status Banner */}
                        {data && (
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monto Total</span>
                                    <span className="text-3xl font-black tracking-tighter text-primary">
                                        {formatCurrency(currentType === 'journal_entry' ? (data.items || []).reduce((acc: number, i: any) => acc + (Number(i.debit) || 0), 0) : (data.total || 0))}
                                    </span>
                                </div>
                                <div className="h-10 w-[1.5px] bg-border/50 hidden md:block" />
                                <div className="flex flex-col items-end min-w-[120px]">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Estado</span>
                                    <BannerStatus status={data.status || data.state} type={currentType} />
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    {(currentType === 'sale_order' || currentType === 'invoice' || currentType === 'purchase_order') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="font-black text-[10px] uppercase tracking-wider h-10 px-4 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-xl"
                                            onClick={() => setEditingPayment(data)}
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-2" /> Registrar Pago
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Scrollable Area */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4">
                                <div className="relative">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                                    <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-0 left-0 [animation-delay:-0.2s]" />
                                </div>
                                <p className="text-[11px] font-black text-primary/40 uppercase tracking-[0.2em] animate-pulse">Procesando Información</p>
                            </div>
                        ) : data ? (
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {/* Left Content Area (75%) */}
                                <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-12">

                                    {/* Section: Main Header Info (Customer/Partner) */}
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-border/50">
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                Entidad Relacionada
                                            </h4>
                                            <p className="text-3xl font-black text-primary leading-none tracking-tight">
                                                {data.customer_name || data.supplier_name || data.partner_name || data.contact_name || (currentType === 'journal_entry' ? 'Asiento Contable' : 'N/A')}
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="font-mono text-[10px] font-bold py-0 h-5 px-1.5 uppercase bg-muted/30">
                                                    {data.customer_code || data.supplier_code || data.partner_id || 'ID-EXTERNO'}
                                                </Badge>
                                                <div className="h-1 w-1 rounded-full bg-border" />
                                                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {formatPlainDate(data.date || data.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quick Data for Inventory/Works */}
                                        {currentType === 'work_order' && (
                                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase">Progreso</span>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <Progress value={data.production_progress || 0} className="h-2 w-24" />
                                                        <span className="font-black text-sm">{Math.round(data.production_progress || 0)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Section 1: Summary Cards (Always visible if data exists) */}
                                    {(view === 'all' || view === 'details' || view === 'history') && (
                                        <div className="space-y-4">
                                            {/* Section: Detail Lines Table */}
                                            {(view === 'all' || view === 'details') && (
                                                <div className="space-y-6">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2.5">
                                                            <div className="h-8 w-1 bg-primary rounded-full" />
                                                            Detalle de Ítems
                                                        </h3>
                                                    </div>

                                                    <div className="border border-border/60 rounded-3xl overflow-hidden bg-background shadow-sm">
                                                        {currentType === 'journal_entry' ? (
                                                            <Table>
                                                                <TableHeader className="bg-muted/30 backdrop-blur-sm">
                                                                    <TableRow className="hover:bg-transparent border-none">
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Cuenta Contable</TableHead>
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Glosa</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[160px]">Debe</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[160px] px-6">Haber</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.items || []).map((item: any, idx: number) => (
                                                                        <TableRow key={item.id || idx} className="hover:bg-muted/5 transition-colors border-border/40">
                                                                            <TableCell className="px-6 py-4">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-[13px] tracking-tight">{item.account_name}</span>
                                                                                    <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase font-bold mt-0.5">{item.account_code}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-xs italic text-muted-foreground leading-snug">{item.label || '-'}</TableCell>
                                                                            <TableCell className="text-right font-black text-[13px] text-blue-600 font-mono tracking-tighter">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                                                            <TableCell className="text-right font-black text-[13px] text-emerald-600 font-mono tracking-tighter px-6">{Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        ) : currentType === 'sale_delivery' || currentType === 'purchase_receipt' ? (
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow className="hover:bg-transparent border-none">
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Producto</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px]">Cant. Orden</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[100px]">UOM</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Procesado</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.lines || []).map((line: any) => (
                                                                        <TableRow key={line.id} className="hover:bg-muted/5 border-border/40">
                                                                            <TableCell className="px-6 py-4">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-[13px] tracking-tight">{line.product_name}</span>
                                                                                    <span className="text-[9px] font-mono text-muted-foreground uppercase">{line.product_code}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-bold text-[13px] text-muted-foreground font-mono">
                                                                                {Number(line.order_quantity).toLocaleString()}
                                                                            </TableCell>
                                                                            <TableCell className="text-center font-black text-[10px] uppercase text-muted-foreground/60">
                                                                                {line.uom_name || 'UN'}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-black text-base text-orange-600 font-mono tracking-tighter px-6">
                                                                                {Number(line.quantity).toLocaleString()}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        ) : (
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow className="hover:bg-transparent border-none">
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Descripción del Producto</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[100px]">Cant.</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px]">P. Unit.</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[160px] px-6">Subtotal</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.lines || data.items || []).map((item: any, idx: number) => (
                                                                        <TableRow key={item.id || idx} className="hover:bg-muted/5 border-border/40">
                                                                            <TableCell className="px-6 py-4">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-[13px] tracking-tight leading-tight">{item.description || item.product_name}</span>
                                                                                    <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">{item.product_code}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-center font-bold text-[13px] font-mono">{Math.round(parseFloat(item.quantity || 0))}</TableCell>
                                                                            <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">{formatCurrency(item.unit_price || item.unit_cost)}</TableCell>
                                                                            <TableCell className="text-right font-black text-[14px] text-primary font-mono tracking-tighter px-6">{formatCurrency(item.subtotal)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Main Content Sections Continued */}
                                            <div className="space-y-12">
                                                {/* Cash Movement Visualization */}
                                                {currentType === 'cash_movement' && (
                                                    <div className="space-y-6">
                                                        <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2.5">
                                                            <div className="h-8 w-1 bg-primary rounded-full" />
                                                            Flujo de Fondos
                                                        </h3>
                                                        <div className="bg-muted/30 p-8 rounded-3xl border border-dashed flex items-center justify-between gap-6 font-medium">
                                                            <div className="flex-1 text-center space-y-2">
                                                                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Origen</div>
                                                                <div className="font-black text-lg truncate px-2 text-primary tracking-tight">
                                                                    {data.from_container_name || (data.movement_type === 'DEPOSIT' ? 'Exterior' : '-')}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-center flex-shrink-0 text-muted-foreground">
                                                                <span className="text-[9px] font-black tracking-[0.2em] uppercase mb-2 opacity-40">
                                                                    {data.movement_type === 'TRANSFER' ? 'TRASPASO' : data.movement_type === 'DEPOSIT' ? 'ENTRADA' : 'SALIDA'}
                                                                </span>
                                                                <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-border to-transparent relative">
                                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-border rotate-45 transform" />
                                                                </div>
                                                            </div>

                                                            <div className="flex-1 text-center space-y-2">
                                                                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Destino</div>
                                                                <div className="font-black text-lg truncate px-2 text-primary tracking-tight">
                                                                    {data.to_container_name || (data.movement_type === 'WITHDRAWAL' ? 'Exterior' : '-')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 3: Related Documents */}
                                    {(view === 'all' || view === 'details') && (
                                        <RelatedDocumentsSection
                                            currentType={currentType}
                                            data={data}
                                            navigateTo={navigateTo}
                                        />
                                    )}

                                    {/* Section 4: Payment History */}
                                    {(view === 'all' || view === 'history') &&
                                        (currentType === 'sale_order' || currentType === 'purchase_order' || currentType === 'invoice') && (
                                            <PaymentHistorySection
                                                currentType={currentType}
                                                data={data}
                                                navigateTo={navigateTo}
                                                handleDeletePayment={handleDeletePayment}
                                            />
                                        )}
                                </div>

                                {/* Right Content Area (25%) - Metadata Sidebar */}
                                <div className="w-full lg:w-[320px] bg-muted/20 border-l border-border/50 lg:min-h-full">
                                    <div className="p-8 lg:p-10 lg:sticky lg:top-0 space-y-10">
                                        <SidebarContent
                                            currentType={currentType}
                                            data={data}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {editingPayment && (
                    <PaymentForm
                        open={!!editingPayment}
                        onOpenChange={(open) => !open && setEditingPayment(null)}
                        initialData={{
                            payment_type: editingPayment.isReceivable ? "INBOUND" : "OUTBOUND",
                            amount: editingPayment.amount,
                            invoice_id: editingPayment.transactionId,
                            reference: `Pago para ${editingPayment.transactionType} #${editingPayment.transactionId}`
                        }}
                        onSuccess={() => {
                            setEditingPayment(null)
                            fetchData()
                        }}
                    />
                )}
            </BaseModal>
        </>
    )
}
