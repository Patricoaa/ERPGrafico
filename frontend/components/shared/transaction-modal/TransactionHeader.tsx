"use client"

import React from "react"
import { ArrowLeft, Printer, X, Receipt, ShoppingBag, FileText, Hash, Package, Banknote, ClipboardList, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { TransactionType, TransactionData } from "@/types/transactions"

export interface TransactionHeaderProps {
    type: TransactionType
    data: TransactionData | null
    view?: 'details' | 'history' | 'all'
    canGoBack: boolean
    onGoBack: () => void
    onPrint: () => void
    onClose: () => void
}

export function TransactionHeader({
    type,
    data,
    view,
    canGoBack,
    onGoBack,
    onPrint,
    onClose
}: TransactionHeaderProps) {

    const getHeaderInfo = () => {
        if (!data) return { main: "DETALLE DE TRANSACCIÓN", sub: "" }
        if (view === 'history') return { main: "HISTORIAL DE PAGOS", sub: data.display_id || data.number || data.id }

        switch (type) {
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
            case 'stock_move':
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

    const getIcon = () => {
        if (view === 'history') return <History className="h-5 w-5 text-success" />
        if (type === 'sale_order') return <ShoppingBag className="h-5 w-5 text-primary" />
        if (type === 'purchase_order') return <FileText className="h-5 w-5 text-primary" />
        if (type === 'invoice') return <Receipt className="h-5 w-5 text-primary" />
        if (type === 'journal_entry') return <Hash className="h-5 w-5 text-primary" />
        if (type === 'inventory' || type === 'stock_move') return <Package className="h-5 w-5 text-primary" />
        if (type === 'payment') return <Banknote className="h-5 w-5 text-success" />
        if (type === 'work_order') return <ClipboardList className="h-5 w-5 text-primary" />
        if (type === 'sale_delivery' || type === 'purchase_receipt') return <Package className="h-5 w-5 text-warning" />
        if (type === 'cash_movement') return <ArrowLeft className="h-5 w-5 text-primary" />
        return <FileText className="h-5 w-5 text-primary" />
    }

    return (
        <div className="border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 relative print:hidden">
            {/* Back button and Basic Info */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    {canGoBack && (
                        <Button variant="ghost" size="icon" onClick={onGoBack} className="h-9 w-9 rounded-full bg-background shadow-sm hover:bg-muted border border-border/50 print:hidden">
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </Button>
                    )}
                    <div className="p-3 bg-background rounded-lg shadow-sm border border-primary/10">
                        {getIcon()}
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black tracking-tight text-primary uppercase leading-none">{mainTitle}</h2>
                        {subTitle && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-black text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-dashed uppercase tracking-wider">{subTitle}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons & Close Control */}
            <div className="flex items-center gap-4 print:hidden">
                {/* ButtonGroup Container */}
                <div className="flex items-center bg-background rounded-lg shadow-sm border border-border/60 overflow-hidden">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onPrint}
                        className="font-bold hover:bg-primary/5 hover:text-primary gap-2 transition-all h-10 px-4 rounded-none border-0"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir
                    </Button>
                </div>

                <div className="flex items-center h-8">
                    <Separator orientation="vertical" className="w-[1px] h-6 bg-border/60" />
                </div>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all" 
                    onClick={onClose}
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}
