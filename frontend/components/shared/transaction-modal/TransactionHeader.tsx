"use client"

import { ArrowLeft, Printer, X, Receipt, ShoppingBag, FileText, Hash, Package, Banknote, ClipboardList, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SheetCloseButton } from "../SheetCloseButton"
import type { TransactionType, TransactionData } from "@/types/transactions"

import { getEntityMetadata, formatEntityDisplay, ENTITY_REGISTRY } from "@/lib/entity-registry"

import { EntityHeader } from "../EntityHeader"

export interface TransactionHeaderProps {
    /** @deprecated Use entityLabel instead */
    type?: TransactionType
    entityLabel?: string
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
    entityLabel,
    data,
    view,
    canGoBack,
    onGoBack,
    onPrint,
    onClose
}: TransactionHeaderProps) {

    // Transition logic: prefer entityLabel if provided, fallback to legacy type mapping
    const label = entityLabel || (type ? TYPE_TO_LABEL[type] : '');
    const metadata = getEntityMetadata(label || '');

    const getHeaderInfo = () => {
        if (!data) return { main: "DETALLE DE TRANSACCIÓN", sub: "" }
        if (view === 'history') return { main: "HISTORIAL DE PAGOS", sub: data.display_id || data.number || data.id }

        // Special case for Invoices (DTE labels)
        if (type === 'invoice' || label === 'billing.invoice') {
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

        return { main: undefined, sub: undefined } // Let EntityHeader handle defaults
    }

    const { main: customTitle } = getHeaderInfo()

    return (
        <EntityHeader
            entityLabel={label || ''}
            data={data}
            customTitle={customTitle}
            className="border-none pb-4"
        >
            <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
                {canGoBack && (
                    <Button variant="ghost" size="icon" onClick={onGoBack} className="h-9 w-9 rounded-full bg-background shadow-sm hover:bg-muted border border-border/50 print:hidden" title="Volver">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </Button>
                )}
                
                <div className="flex-1 md:flex-none"></div>

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
        </EntityHeader>
    )
}
