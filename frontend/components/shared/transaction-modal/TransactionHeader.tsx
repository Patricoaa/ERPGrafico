"use client"

import { ArrowLeft, Printer, X, Receipt, ShoppingBag, FileText, Hash, Package, Banknote, ClipboardList, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SheetCloseButton } from "../SheetCloseButton"
import type { TransactionType, TransactionData } from "@/types/transactions"

import { getEntityMetadata, formatEntityDisplay, ENTITY_REGISTRY } from "@/lib/entity-registry"

export interface TransactionHeaderProps {
    type: TransactionType
    data: TransactionData | null
    view?: 'details' | 'history' | 'all'
    canGoBack: boolean
    onGoBack: () => void
    onPrint: () => void
    onClose: () => void
}

const TYPE_TO_LABEL: Record<string, string> = {
    'sale_order': 'sales.saleorder',
    'purchase_order': 'purchasing.purchaseorder',
    'invoice': 'billing.invoice',
    'payment': 'treasury.treasurymovement',
    'journal_entry': 'accounting.journalentry',
    'inventory': 'inventory.stockmove',
    'stock_move': 'inventory.stockmove',
    'work_order': 'production.workorder',
    'sale_delivery': 'sales.saledelivery',
    'purchase_receipt': 'inventory.warehouse',
    'sale_return': 'sales.salereturn',
    'purchase_return': 'sales.salereturn',
    'cash_movement': 'treasury.treasurymovement',
    'terminal_batch': 'treasury.treasurymovement', // or batch label if added
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

    const label = TYPE_TO_LABEL[type];
    const metadata = getEntityMetadata(label || '');

    const getHeaderInfo = () => {
        if (!data) return { main: "DETALLE DE TRANSACCIÓN", sub: "" }
        if (view === 'history') return { main: "HISTORIAL DE PAGOS", sub: data.display_id || data.number || data.id }

        // Special case for Invoices (DTE labels)
        if (type === 'invoice') {
            const typeLabel = data.dte_type === 'NOTA_CREDITO' ? 'Nota de Crédito' :
                data.dte_type === 'NOTA_DEBITO' ? 'Nota de Débito' :
                data.dte_type === 'BOLETA' ? 'Boleta de Venta' :
                data.dte_type === 'FACTURA_EXENTA' ? 'Factura Exenta' :
                data.dte_type === 'BOLETA_EXENTA' ? 'Boleta Exenta' : 'Factura de Venta';
            
            return { 
                main: `Comprobante de ${typeLabel}`, 
                sub: formatEntityDisplay('billing.invoice', data) 
            }
        }

        // Standard case using registry
        if (metadata) {
            return { 
                main: metadata.title, 
                sub: formatEntityDisplay(label, data) 
            }
        }

        // Fallbacks
        return { main: "Detalles de Transacción", sub: data.display_id || data.number || data.id }
    }

    const { main: mainTitle, sub: subTitle } = getHeaderInfo()

    const getIcon = () => {
        if (view === 'history') return <History className="h-5 w-5 text-success" />
        
        const Icon = metadata?.icon || FileText;
        const colorClass = type === 'payment' ? 'text-success' : 
                         (type === 'sale_delivery' || type === 'purchase_receipt') ? 'text-warning' : 
                         'text-primary';
        
        return <Icon className={cn("h-5 w-5", colorClass)} />
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

                <SheetCloseButton
                    onClick={onClose}
                    className="hover:bg-destructive/10 hover:text-destructive"
                />
            </div>
        </div>
    )
}
