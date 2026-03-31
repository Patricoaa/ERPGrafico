"use client"

import { BannerStatus } from "./transaction-modal/BannerStatus"
import { MetadataItem } from "./transaction-modal/MetadataItem"
import { SidebarSection, SidebarContent } from "./transaction-modal/SidebarContent"
import { RelatedDocumentsSection } from "./transaction-modal/RelatedDocumentsSection"
import { PaymentHistorySection } from "./transaction-modal/PaymentHistorySection"
import { PrintableReceipt } from "./transaction-modal/PrintableReceipt"
import React, { useState, useEffect, Fragment, useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { BaseModal } from "@/components/shared/BaseModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash, Package, Eye, ArrowLeft, Building2, User, Paperclip, History, Plus, Save, Edit, X, Trash2, ClipboardList, Calendar, Printer, Minus, MonitorSmartphone, CalendarClock, CalendarDays, BookOpen, ArrowRightFromLine, ArrowRightToLine, Wallet, Activity, ExternalLink, Gavel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { translateStatus, translatePaymentMethod, translateReceivingStatus, formatCurrency, formatPlainDate, cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { Progress } from "@/components/ui/progress"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { AttachmentList } from "./AttachmentList"
import { useRouter } from "next/navigation"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useBranding } from "@/contexts/BrandingProvider"
import { Separator } from "@/components/ui/separator"

type EntityType = 'product' | 'contact' | 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'sale_delivery' | 'purchase_receipt' | 'user' | 'company_settings' | 'work_order' | 'journal_entry' | 'stock_move' | 'cash_movement'

export interface TransactionLine {
    id?: number | string;
    product_type?: string;
    subtotal?: string | number;
    amount?: string | number;
    discount_amount?: string | number;
    product_name?: string;
    product_code?: string;
    quantity?: number | string;
    uom_name?: string;
    unit_price_gross?: number;
    unit_price?: number;
    unit_cost?: number;
    description?: string;
    product?: { name?: string, sku?: string, default_code?: string };
    uom?: { name?: string };
    delivered_quantity?: number;
    qty_delivered?: number;
    delivery_status?: string;
    sku?: string;
    account_name?: string;
    account_code?: string;
    label?: string;
    debit?: string | number;
    credit?: string | number;
}

export interface RelatedDocument {
    id: number | string;
    display_id: string;
    number?: string | number;
    type?: string;
    type_display?: string;
    docType?: string;
    date?: string;
    amount?: number | string;
    method?: string;
    payment_method?: string;
    payment_method_display?: string;
    code?: string;
}

export interface TransactionData {
    id?: number | string;
    display_id?: string;
    number?: string | number;
    reference?: string;
    transaction_number?: string;
    total_net?: number | string;
    total_tax?: number | string;
    total?: number | string;
    amount?: number | string;
    payment_type?: string;
    movement_type?: string;
    from_container_name?: string;
    to_container_name?: string;
    payment_method?: string;
    dte_type?: string;
    reference_code?: string;
    code?: string;
    total_discount_amount?: number | string;
    total_paid?: number | string;
    terminal_name?: string;
    pos_session?: { id: number, terminal_name?: string };
    session?: { id: number, terminal_name?: string };
    customer?: { id: number, name: string, full_name?: string, tax_id?: string, email?: string, phone?: string, address?: string };
    partner?: { id: number, name: string, full_name?: string, tax_id?: string, email?: string, phone?: string, address?: string };
    partner_name?: string;
    customer_name?: string;
    supplier_name?: string;
    contact_name?: string;
    customer_rut?: string;
    supplier_rut?: string;
    partner_rut?: string;
    folio?: string | number;
    folio_number?: string | number;
    timestamp?: string;
    date?: string;
    due_date?: string;
    created_at?: string;
    status?: string | number;
    payment_status?: string;
    notes?: string;
    invoice_display_id?: string;
    warehouse_name?: string;
    origin_document?: string;
    journal_name?: string;
    period_name?: string;
    move_type_display?: string;
    priority?: string;
    completion_percentage?: number | string;
    lines?: TransactionLine[];
    items?: TransactionLine[];
    adjustments?: RelatedDocument[];
    related_returns?: RelatedDocument[];
    work_orders?: RelatedDocument[];
    related_stock_moves?: RelatedDocument[];
    journal_entry?: number | string | RelatedDocument;
    journal_entry_number?: string;
    journal_entry_display_id?: string;
    related_documents?: {
        invoices?: RelatedDocument[];
        notes?: RelatedDocument[];
        deliveries?: RelatedDocument[];
        receipts?: RelatedDocument[];
        payments?: RelatedDocument[];
    };
    [key: string]: unknown;
}

interface TransactionViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: 'sale_order' | 'purchase_order' | 'invoice' | 'payment' | 'journal_entry' | 'inventory' | 'work_order' | 'sale_delivery' | 'purchase_receipt' | 'cash_movement'
    id: number | string
    view?: 'details' | 'history' | 'all'
}


export function TransactionViewModal({ open, onOpenChange, type: initialType, id: initialId, view = 'all' }: TransactionViewModalProps) {
    const [history, setHistory] = useState<{ type: string, id: number | string }[]>([])
    const [currentType, setCurrentType] = useState<string>(initialType)
    const [currentId, setCurrentId] = useState<number | string>(initialId)
    const [data, setData] = useState<TransactionData | null>(null)
    const [loading, setLoading] = useState(false)
    const [editingPayment, setEditingPayment] = useState<{ isReceivable?: boolean, amount?: number, transactionId?: number | string, transactionType?: string } | null>(null)

    const contentRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: () => {
            const info = getHeaderInfo()
            return info.main || "Detalle de Transacción"
        },
    })

    useEffect(() => {
        if (open) {
            console.log(`[TransactionViewModal] Initializing with type: ${initialType}, id: ${initialId}`)
            setCurrentType(initialType?.toLowerCase())
            setCurrentId(initialId)
            setHistory([])
            setData(null)
            setLoading(true) // Start in loading state
        } else {
            // Reset state when closed to prevent showing old data on next open
            setData(null)
            setHistory([])
            setEditingPayment(null)
        }
    }, [open, initialType, initialId])

    useEffect(() => {
        if (open && currentId && currentId !== 0) {
            fetchData()
        }
    }, [open, currentId, currentType])

    const fetchData = async () => {
        if (!currentId || currentId === 0) return

        const idAtStart = currentId
        const typeAtStart = currentType

        try {
            setLoading(true)
            // Note: we don't null data here to avoid flicker if just refreshing same record
            // but we null it in the useEffect above for new records

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

            // Only update if we're still looking at the same thing
            if (idAtStart === currentId && typeAtStart === currentType) {
                setData(response.data)
            }

        } catch (error) {
            const err = error as { response?: { data?: { error?: string } }, message?: string }
            console.error("Error fetching transaction details:", err)
            const msg = err.response?.data?.error || err.message || "Error desconocido"
            toast.error(`Error al cargar: ${msg}`)
        } finally {
            if (idAtStart === currentId && typeAtStart === currentType) {
                setLoading(false)
            }
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
                return { main: "Nota de Venta", sub: data.display_id || `NV-${data.number || data.id}` }
            case 'purchase_order':
                return { main: "Orden de Compra y Servicios", sub: data.display_id || `OCS-${data.number || data.id}` }
            case 'invoice':
                const typeLabel = data.dte_type === 'NOTA_CREDITO' ? 'Nota de Crédito' :
                    data.dte_type === 'NOTA_DEBITO' ? 'Nota de Débito' :
                        data.dte_type === 'BOLETA' ? 'Boleta de Venta' :
                            data.dte_type === 'FACTURA_EXENTA' ? 'Factura Exenta' :
                                data.dte_type === 'BOLETA_EXENTA' ? 'Boleta Exenta' : 'Factura de Venta'
                
                // Fallback prefix logic if display_id is missing
                const prefix = data.dte_type === 'NOTA_CREDITO' ? 'NC' :
                    data.dte_type === 'NOTA_DEBITO' ? 'ND' :
                        data.dte_type === 'BOLETA' ? 'BOL' :
                            data.dte_type === 'FACTURA_EXENTA' ? 'FAC-EX' :
                                data.dte_type === 'BOLETA_EXENTA' ? 'BE' : 'FAC'
                                
                return { main: `Comprobante de ${typeLabel}`, sub: data.display_id || `${prefix}-${data.number || data.id}` }
            case 'payment':
                const payPrefix = data.payment_type === 'INBOUND' ? 'Comprobante de Ingreso' : 'Comprobante de Egreso'
                const payId = data.display_id || (data.payment_type === 'INBOUND' ? 'DEP-' : 'RET-') + data.id
                return { main: payPrefix, sub: payId }
            case 'journal_entry':
                return { main: "Asiento Contable", sub: data.display_id || `AS-${data.number || data.id}` }
            case 'inventory':
                return { main: "Movimiento de Inventario", sub: data.reference_code || `MOV-${data.id}` }
            case 'work_order':
                return { main: "Orden de Trabajo", sub: data.code || `OT-${data.id}` }
            case 'sale_delivery':
                return { main: "Despacho de Venta", sub: data.display_id || `DES-${data.number || data.id}` }
            case 'purchase_receipt':
                const isService = (data.lines || []).some((l) => l.product_type === 'SERVICE')
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
        if (currentType === 'inventory') return <Package className="h-5 w-5 text-primary" />
        if (currentType === 'payment') return <Banknote className="h-5 w-5 text-emerald-600" />
        if (currentType === 'work_order') return <ClipboardList className="h-5 w-5 text-primary" />
        if (currentType === 'sale_delivery' || currentType === 'purchase_receipt') return <Package className="h-5 w-5 text-amber-700" />
        if (currentType === 'cash_movement') return <ArrowLeft className="h-5 w-5 text-primary" />
        return <FileText className="h-5 w-5" />
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={mainTitle + (subTitle ? ` - ${subTitle}` : "")}
                headerClassName="sr-only"
                size="xl"
                hideScrollArea={true}
                className="overflow-hidden p-0 gap-0 print:border-none print:shadow-none print:bg-white print:text-black [&>button[data-slot=dialog-close]]:hidden"
            >


                {/* Standard hidden receipt for actual browser print command */}
                <PrintableReceipt
                    ref={contentRef}
                    data={data}
                    currentType={currentType}
                    mainTitle={mainTitle}
                    subTitle={subTitle as string}
                />

                <div className="flex flex-col h-[90vh] md:h-[85vh] max-h-[900px] bg-background print:hidden">
                    {/* Header Banner */}
                    <div className="border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 relative">
                        {/* Back button and Basic Info */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                {history.length > 0 && (
                                    <Button variant="ghost" size="icon" onClick={goBack} className="h-9 w-9 rounded-full bg-background shadow-sm hover:bg-muted border border-border/50 print:hidden">
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
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons & Close Control */}
                        <div className="flex items-center gap-4 print:hidden">
                            {/* ButtonGroup Container */}
                            <div className="flex items-center bg-background rounded-xl shadow-sm border border-border/60 overflow-hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePrint}
                                    className="font-bold hover:bg-primary/5 hover:text-primary gap-2 transition-all h-10 px-4 rounded-none border-0"
                                >
                                    <Printer className="h-4 w-4" />
                                    Imprimir
                                </Button>
                                {/* Placeholder for future buttons in the group */}
                            </div>

                            <div className="flex items-center h-8">
                                <Separator orientation="vertical" className="w-[1px] h-6 bg-border/60" />
                            </div>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-all" 
                                onClick={() => onOpenChange(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Status removed from here and moved to sidebar */}
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

                                    {/* Section: Main Header Info (Moved to Sidebar) */}
                                    {/* Content removed */}
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
                                                        {currentType === 'payment' || currentType === 'cash_movement' ? (
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow className="hover:bg-transparent border-none">
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Concepto</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[160px]">Método</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[180px] px-6">Monto</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    <TableRow className="hover:bg-muted/5 border-border/40">
                                                                        <TableCell className="px-6 py-4">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-[13px] tracking-tight">
                                                                                    {currentType === 'payment'
                                                                                        ? (data.payment_type === 'INBOUND' ? 'Ingreso de Efectivo' : 'Egreso de Efectivo')
                                                                                        : data.movement_type === 'DEPOSIT' ? 'Depósito'
                                                                                            : data.movement_type === 'WITHDRAWAL' ? 'Retiro' : 'Traspaso'
                                                                                    }
                                                                                </span>
                                                                                <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">
                                                                                    {data.reference || data.transaction_number || '-'}
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center font-black text-[11px] uppercase text-muted-foreground">
                                                                            {currentType === 'payment'
                                                                                ? translatePaymentMethod(data.payment_method)
                                                                                : currentType === 'cash_movement'
                                                                                    ? (data.from_container_name ? `${data.from_container_name} → ${data.to_container_name}` : 'Efectivo')
                                                                                    : '-'
                                                                            }
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-black text-lg text-emerald-600 font-mono tracking-tighter px-6">
                                                                            {formatCurrency(data.amount)}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        ) : currentType === 'journal_entry' ? (
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
                                                                    {(data.items || []).map((item, idx: number) => (
                                                                        <TableRow key={item.id || idx} className="hover:bg-muted/5 transition-colors border-border/40">
                                                                            <TableCell className="px-6 py-4">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-[13px] tracking-tight">{item.account_name}</span>
                                                                                    <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase font-bold mt-0.5">{item.account_code}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-xs italic text-muted-foreground leading-snug">{item.label || '-'}</TableCell>
                                                                            <TableCell className="text-right font-black text-[13px] text-primary font-mono tracking-tighter">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
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
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px]">Cantidad</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[100px]">UOM</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Tipo</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.lines || []).map((line) => {
                                                                        const isExit = currentType === 'sale_delivery';
                                                                        return (
                                                                            <TableRow key={line.id} className="hover:bg-muted/5 border-border/40">
                                                                                <TableCell className="px-6 py-4">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-bold text-[13px] tracking-tight">{line.product_name}</span>
                                                                                        <span className="text-[9px] font-mono text-muted-foreground uppercase">{line.product_code}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-black text-lg text-primary font-mono tracking-tighter">
                                                                                    {Number(line.quantity).toLocaleString()}
                                                                                </TableCell>
                                                                                <TableCell className="text-center font-black text-[10px] uppercase text-muted-foreground/60">
                                                                                    {line.uom_name || 'UN'}
                                                                                </TableCell>
                                                                                <TableCell className="text-center font-bold text-[11px] uppercase px-6">
                                                                                    {isExit ? (
                                                                                        <span className="text-amber-700 bg-orange-600/10 px-2 py-1 rounded-md">Salida</span>
                                                                                    ) : (
                                                                                        <span className="text-emerald-600 bg-emerald-600/10 px-2 py-1 rounded-md">Entrada</span>
                                                                                    )}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )
                                                                    })}
                                                                </TableBody>
                                                            </Table>
                                                        ) : (
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow className="hover:bg-transparent border-none">
                                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Descripción del Producto</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[80px]">Cant.</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[120px]">P. Unit.</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[120px]">Descuento</TableHead>
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Subtotal</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.lines || data.items || []).map((item, idx: number) => {
                                                                        const hasLineDiscount = parseFloat(String(item.discount_amount || 0)) > 0
                                                                        return (
                                                                            <Fragment key={item.id || idx}>
                                                                                <TableRow className="hover:bg-muted/5 border-border/40">
                                                                                    <TableCell className="px-6 py-4">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-bold text-[13px] tracking-tight leading-tight">{item.description || item.product_name}</span>
                                                                                            <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">{item.product_code}</span>
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-center font-bold text-[13px] font-mono">{Math.round(parseFloat(String(item.quantity || 0)))}</TableCell>
                                                                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">{formatCurrency(item.unit_price_gross || item.unit_price || item.unit_cost)}</TableCell>
                                                                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">
                                                                                        {hasLineDiscount ? (
                                                                                            <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm">
                                                                                                -{formatCurrency(item.discount_amount)}
                                                                                            </span>
                                                                                        ) : '-'}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right font-black text-[14px] text-primary font-mono tracking-tighter px-6">
                                                                                        {formatCurrency(item.subtotal)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            </Fragment>
                                                                        )
                                                                    })}
                                                                </TableBody>
                                                            </Table>
                                                        )}
                                                    </div>

                                                    {/* Totals Summary Section */}
                                                    {(currentType === 'sale_order' || currentType === 'invoice') && data && (
                                                        <div className="flex justify-end pt-4">
                                                            <div className="w-full md:w-80 space-y-3 bg-muted/30 p-6 rounded-3xl border border-border/40">
                                                                {(() => {
                                                                    const lines = data.lines || data.items || [];
                                                                    const itemsSum = lines.reduce((acc: number, item) => acc + parseFloat(String(item.subtotal || "0")), 0);
                                                                    const lineDiscountsSum = lines.reduce((acc: number, item) => acc + parseFloat(String(item.discount_amount || "0")), 0);
                                                                    const globalDiscount = parseFloat(String(data.total_discount_amount || "0"));

                                                                    return (
                                                                        <>
                                                                            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                                                <span>Suma de Productos:</span>
                                                                                <span className="font-mono text-primary">{formatCurrency(itemsSum + lineDiscountsSum)}</span>
                                                                            </div>

                                                                            {lineDiscountsSum > 0 && (
                                                                                <div className="flex justify-between items-center text-xs font-bold text-primary/70 uppercase tracking-wider italic">
                                                                                    <span>Descuentos por Línea:</span>
                                                                                    <span className="font-mono">-{formatCurrency(lineDiscountsSum)}</span>
                                                                                </div>
                                                                            )}

                                                                            {globalDiscount > 0 && (
                                                                                <div className="flex justify-between items-center text-xs font-bold text-destructive uppercase tracking-wider bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Plus className="h-3 w-3 rotate-45" />
                                                                                        <span>Descuento Global:</span>
                                                                                    </div>
                                                                                    <span className="font-mono">-{formatCurrency(globalDiscount)}</span>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}

                                                                <div className="pt-2 border-t border-border/60 space-y-2">
                                                                    <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                                                                        <span>Neto:</span>
                                                                        <span className="font-mono">{formatCurrency(data.total_net)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                                                                        <span>IVA (19%):</span>
                                                                        <span className="font-mono">{formatCurrency(data.total_tax)}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-3 border-t-2 border-primary/20 flex justify-between items-center group">
                                                                    <span className="text-sm font-black text-primary uppercase tracking-tighter">Total a Pagar:</span>
                                                                    <span className="text-2xl font-black text-primary font-mono tracking-tighter group-hover:scale-105 transition-transform origin-right">
                                                                        {formatCurrency(data.total)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
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


                                </div>

                                {/* Right Content Area (25%) - Metadata Sidebar */}
                                <div className="w-full lg:w-[320px] bg-muted/20 border-l border-border/50 lg:min-h-full print:hidden">
                                    <div className="p-8 lg:p-10 lg:sticky lg:top-0 space-y-10">
                                        <SidebarContent
                                            currentType={currentType}
                                            data={data}
                                            closeModal={() => onOpenChange(false)}
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

export default TransactionViewModal
