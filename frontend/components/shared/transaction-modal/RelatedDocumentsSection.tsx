"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Package, Eye } from "lucide-react"
import type { TransactionData, RelatedDocument, TransactionType } from "@/types/transactions"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const documentCardVariants = cva(
    "transition-all cursor-pointer shadow-sm hover:opacity-80 border",
    {
        variants: {
            variant: {
                primary: "border-primary/20 bg-primary/5",
                success: "border-success/20 bg-success/5",
                warning: "border-warning/20 bg-warning/5",
                destructive: "border-destructive/20 bg-destructive/5",
                accent: "border-accent/20 bg-accent/5",
                muted: "border-muted bg-muted/50",
            }
        },
        defaultVariants: {
            variant: "primary"
        }
    }
)

const iconWrapperVariants = cva(
    "p-2 rounded-lg",
    {
        variants: {
            variant: {
                primary: "bg-primary/10 text-primary",
                success: "bg-success/10 text-success",
                warning: "bg-warning/10 text-warning",
                destructive: "bg-destructive/10 text-destructive",
                accent: "bg-accent/10 text-accent",
                muted: "bg-muted-foreground/10 text-muted-foreground",
            }
        },
        defaultVariants: {
            variant: "primary"
        }
    }
)

const textVariants = cva(
    "font-black text-sm",
    {
        variants: {
            variant: {
                primary: "text-primary",
                success: "text-success",
                warning: "text-warning",
                destructive: "text-destructive",
                accent: "text-accent",
                muted: "text-muted-foreground",
            }
        },
        defaultVariants: {
            variant: "primary"
        }
    }
)

import { getEntityMetadata, formatEntityDisplay } from "@/lib/entity-registry"

export type RelatedDocVariant = VariantProps<typeof documentCardVariants>["variant"]

export const RelatedDocumentsSection = React.memo(({ data: rawData, currentType, navigateTo }: { data: TransactionData, currentType: TransactionType, navigateTo: (type: TransactionType, id: number | string) => void }) => {
    const data = rawData as any;
    if (!data) return null;

    const renderCard = (label: string, id: number | string, customTitle: string, displayData: any, variant: RelatedDocVariant = "primary", navType?: TransactionType) => {
        const metadata = getEntityMetadata(label);
        const subtitle = formatEntityDisplay(label, displayData);
        const Icon = metadata?.icon || Package;
        const targetType = navType || label.split('.')[1] as TransactionType;

        return (
            <Card key={`${label}-${id}-${customTitle.replace(/\s+/g, '-')}`} className={documentCardVariants({ variant })} onClick={() => navigateTo(targetType, id)}>
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <div className={iconWrapperVariants({ variant })}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-black">{customTitle || metadata?.title}</div>
                            <div className={textVariants({ variant })}>{subtitle}</div>
                        </div>
                        <Eye className={cn("h-4 w-4", textVariants({ variant }).replace("font-black text-sm", ""))} />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Collected documents from related_documents or individual fields
    const relatedDocs = (data.related_documents || {}) as any;
    const hasAnyDocuments =
        // Invoice documents
        data.sale_order || data.purchase_order || data.corrected_invoice ||
        // Order documents
        (relatedDocs.invoices?.length || 0) > 0 || (relatedDocs.notes?.length || 0) > 0 ||
        (relatedDocs.deliveries?.length || 0) > 0 || (relatedDocs.receipts?.length || 0) > 0 ||
        (relatedDocs.payments?.length || 0) > 0 ||
        // Invoice-specific
        (data.related_returns?.length || 0) > 0 || (data.adjustments?.length || 0) > 0 ||
        (data.work_orders?.length || 0) > 0 || (data.related_stock_moves?.length || 0) > 0 ||
        // Common
        data.work_order || data.journal_entry;

    if (!hasAnyDocuments) return null;

    return (
        <div className="space-y-4 pt-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                <ArrowLeft className="h-5 w-5 rotate-180 text-primary" />
                Documentos Relacionados
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* ===== INVOICE RELATIONSHIPS ===== */}
                {currentType === 'invoice' && (
                    <>
                        {/* Origin Documents */}
                        {data.sale_order && renderCard('sales.saleorder', data.sale_order, 'Nota de Venta Origen', { number: data.sale_order_number || data.sale_order }, 'primary', 'sale_order')}
                        {data.purchase_order && renderCard('purchasing.purchaseorder', data.purchase_order, 'Orden de Compra Origen', { number: data.purchase_order_number || data.purchase_order }, 'primary', 'purchase_order')}

                        {/* Corrected Invoice */}
                        {data.corrected_invoice && renderCard('billing.invoice', data.corrected_invoice.id, 'Documento Rectificado', data.corrected_invoice, 'warning', 'invoice')}

                        {/* Adjustments (NC/ND that correct THIS invoice) */}
                        {data.adjustments?.map((adj: RelatedDocument) => renderCard('billing.invoice', adj.id, adj.type_display || 'Ajuste', adj, 'warning', 'invoice'))}

                        {/* Related Returns (for NC/ND) */}
                        {data.related_returns?.map((ret: RelatedDocument) => renderCard('sales.salereturn', ret.id, ret.type || 'Devolución', ret, 'destructive', 'inventory'))}

                        {/* Work Orders (for Debit Notes) */}
                        {data.work_orders?.map((wo: RelatedDocument) => renderCard('production.workorder', wo.id, 'Orden de Trabajo', wo, 'accent', 'work_order'))}

                        {/* Stock Moves (for NC/ND) */}
                        {data.related_stock_moves?.map((move: RelatedDocument) => renderCard('inventory.stockmove', move.id, 'Movimiento de Inventario', move, 'primary', 'inventory'))}
                    </>
                )}

                {/* ===== SALE ORDER RELATIONSHIPS ===== */}
                {currentType === 'sale_order' && (
                    <>
                        {/* Invoices (primary invoices only) */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('billing.invoice', inv.id, inv.type_display || 'Factura', inv, 'success', 'invoice'))}
 
                        {/* Notes (NC/ND) */}
                        {(relatedDocs.notes || []).map((note: RelatedDocument) => renderCard('billing.invoice', note.id, note.type_display || 'Nota', note, 'warning', 'invoice'))}
 
                        {/* Deliveries */}
                        {(relatedDocs.deliveries || []).map((del: RelatedDocument) => renderCard('sales.saledelivery', del.id, 'Despacho', del, 'warning', 'sale_delivery'))}
 
                        {/* Payments */}
                        {(relatedDocs.payments || []).map((pay: RelatedDocument) => renderCard('treasury.treasurymovement', pay.id, `Pago - ${pay.payment_method_display || pay.method || ''}`, pay, 'success', 'payment'))}
                    </>
                )}

                {/* ===== LOGISTICS (DELIVERY/RECEIPT) RELATIONSHIPS ===== */}
                {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                    <>
                        {/* Origin Order */}
                        {data.sale_order && renderCard('sales.saleorder', data.sale_order, 'Nota de Venta Origen', { number: data.sale_order_number || data.sale_order_display_id || data.sale_order }, 'primary', 'sale_order')}
                        {data.purchase_order && renderCard('purchasing.purchaseorder', data.purchase_order, 'Orden de Compra Origen', { number: data.purchase_order_number || data.purchase_order_display_id || data.purchase_order }, 'primary', 'purchase_order')}

                        {/* Invoices */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('billing.invoice', inv.id, inv.type_display || 'Factura', inv, 'success', 'invoice'))}

                        {/* Journal Entry */}
                        {data.journal_entry && renderCard('accounting.journalentry', (typeof data.journal_entry === 'object' ? data.journal_entry.id : data.journal_entry), 'Asiento Contable', data.journal_entry, 'primary', 'journal_entry')}
                    </>
                )}

                {/* ===== PURCHASE ORDER RELATIONSHIPS ===== */}
                {currentType === 'purchase_order' && (
                    <>
                        {/* Work Order Origin */}
                        {data.work_order && renderCard('production.workorder', data.work_order as number, 'Orden de Trabajo Origen', { number: data.work_order_number || data.work_order }, 'accent', 'work_order')}

                        {/* Invoices (primary invoices only) */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('billing.invoice', inv.id, inv.type_display || 'Factura', inv, 'success', 'invoice'))}

                        {/* Notes (NC/ND) */}
                        {(relatedDocs.notes || []).map((note: RelatedDocument) => renderCard('billing.invoice', note.id, note.type_display || 'Nota', note, 'warning', 'invoice'))}

                        {/* Receipts */}
                        {(relatedDocs.receipts || []).map((rec: RelatedDocument) => {
                            const label = rec.docType === 'inventory' ? 'inventory.stockmove' : 'inventory.warehouse'; // Heuristic for rec.docType
                            const type = rec.docType === 'inventory' ? 'inventory' : 'purchase_receipt';
                            return renderCard(label, rec.id, rec.docType === 'inventory' ? 'Movimiento de Inventario' : 'Recepción', rec, rec.docType === 'inventory' ? 'primary' : 'warning', type as TransactionType);
                        })}
 
                        {/* Payments */}
                        {(relatedDocs.payments || []).map((pay: RelatedDocument) => renderCard('treasury.treasurymovement', pay.id, `Pago - ${pay.payment_method_display || pay.method || ''}`, pay, 'success', 'payment'))}
                    </>
                )}

                {/* ===== PAYMENT RELATIONSHIPS ===== */}
                {currentType === 'payment' && (
                    <>
                        {/* Unified Document Info from Backend */}
                        {data.document_info && renderCard(
                            data.document_info.type === 'invoice' ? 'billing.invoice' : 
                            data.document_info.type === 'journal_entry' ? 'accounting.journalentry' : 
                            data.document_info.type === 'sale_order' ? 'sales.saleorder' : 'purchasing.purchaseorder',
                            data.document_info.id, 
                            'Documento Vinculado', 
                            data.document_info, 
                            data.document_info.type === 'invoice' ? 'success' : 
                            data.document_info.type === 'journal_entry' ? 'accent' : 'primary',
                            data.document_info.type as TransactionType
                        )}

                        {/* Fallback Legacy Fields */}
                        {!data.document_info && (
                            <>
                                {data.invoice && renderCard('billing.invoice', data.invoice, 'DTE Vinculado', { number: data.invoice_number || data.invoice, dte_type: 'FAC' }, 'success', 'invoice')}
                                {data.sale_order && renderCard('sales.saleorder', data.sale_order, 'Nota de Venta', { number: data.sale_order_number || data.sale_order }, 'primary', 'sale_order')}
                                {data.purchase_order && renderCard('purchasing.purchaseorder', data.purchase_order, 'Orden de Compra', { number: data.purchase_order_number || data.purchase_order }, 'primary', 'purchase_order')}
                            </>
                        )}
                    </>
                )}

                {/* ===== COMMON: JOURNAL ENTRY ===== */}
                {data.journal_entry && renderCard('accounting.journalentry', (typeof data.journal_entry === 'object' ? data.journal_entry.id : data.journal_entry), 'Asiento Contable', data.journal_entry, 'primary', 'journal_entry')}
            </div>
        </div>
    );
})

RelatedDocumentsSection.displayName = "RelatedDocumentsSection"
