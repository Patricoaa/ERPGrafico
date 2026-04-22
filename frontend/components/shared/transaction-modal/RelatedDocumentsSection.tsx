"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ShoppingBag, FileText, Receipt, Package, ClipboardList, Banknote, Hash, Eye } from "lucide-react"
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

export type RelatedDocVariant = VariantProps<typeof documentCardVariants>["variant"]

export const RelatedDocumentsSection = React.memo(({ data: rawData, currentType, navigateTo }: { data: TransactionData, currentType: TransactionType, navigateTo: (type: TransactionType, id: number | string) => void }) => {
    const data = rawData as any;
    if (!data) return null;

    const renderCard = (type: TransactionType, id: number | string, title: string, subtitle: string, icon: React.ReactNode, variant: RelatedDocVariant = "primary") => (
        <Card key={`${type}-${id}-${title.replace(/\s+/g, '-')}`} className={documentCardVariants({ variant })} onClick={() => navigateTo(type, id)}>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={iconWrapperVariants({ variant })}>
                        {icon}
                    </div>
                    <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground uppercase font-black">{title}</div>
                        <div className={textVariants({ variant })}>{subtitle}</div>
                    </div>
                    <Eye className={cn("h-4 w-4", textVariants({ variant }).replace("font-black text-sm", ""))} />
                </div>
            </CardContent>
        </Card>
    );

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
                        {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta Origen', `NV-${data.sale_order_number || data.sale_order}`, <ShoppingBag className="h-5 w-5" />, 'primary')}
                        {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra Origen', `OCS-${data.purchase_order_number || data.purchase_order}`, <FileText className="h-5 w-5" />, 'primary')}

                        {/* Corrected Invoice */}
                        {data.corrected_invoice && renderCard('invoice', data.corrected_invoice.id, 'Documento Rectificado', String(data.corrected_invoice.display_id || ''), <Receipt className="h-5 w-5" />, 'warning')}

                        {/* Adjustments (NC/ND that correct THIS invoice) */}
                        {data.adjustments?.map((adj: RelatedDocument) => renderCard('invoice', adj.id, adj.type_display || 'Ajuste', String(adj.display_id || ''), <Receipt className="h-5 w-5" />, 'warning'))}

                        {/* Related Returns (for NC/ND) */}
                        {data.related_returns?.map((ret: RelatedDocument) => renderCard((ret.docType as TransactionType) || 'inventory', ret.id, ret.type || 'Devolución', String(ret.display_id || ''), <Package className="h-5 w-5" />, 'destructive'))}

                        {/* Work Orders (for Debit Notes) */}
                        {data.work_orders?.map((wo: RelatedDocument) => renderCard('work_order', wo.id, 'Orden de Trabajo', String(wo.number || wo.display_id || ''), <ClipboardList className="h-5 w-5" />, 'accent'))}

                        {/* Stock Moves (for NC/ND) */}
                        {data.related_stock_moves?.map((move: RelatedDocument) => renderCard('inventory', move.id, 'Movimiento de Inventario', String(move.display_id || ''), <Package className="h-5 w-5" />, 'primary'))}
                    </>
                )}

                {/* ===== SALE ORDER RELATIONSHIPS ===== */}
                {currentType === 'sale_order' && (
                    <>
                        {/* Invoices (primary invoices only) */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('invoice', inv.id, inv.type_display || 'Factura', String(inv.number || inv.display_id || ''), <Receipt className="h-5 w-5" />, 'success'))}
 
                        {/* Notes (NC/ND) */}
                        {(relatedDocs.notes || []).map((note: RelatedDocument) => renderCard('invoice', note.id, note.type_display || 'Nota', String(note.number || note.display_id || ''), <Receipt className="h-5 w-5" />, 'warning'))}
 
                        {/* Deliveries */}
                        {(relatedDocs.deliveries || []).map((del: RelatedDocument) => renderCard('sale_delivery', del.id, 'Despacho', String(del.display_id || ''), <Package className="h-5 w-5" />, 'warning'))}
 
                        {/* Payments */}
                        {(relatedDocs.payments || []).map((pay: RelatedDocument) => renderCard('payment', pay.id, `Pago - ${pay.payment_method_display || pay.method || ''}`, String(pay.code || pay.display_id || ''), <Banknote className="h-5 w-5" />, 'success'))}
                    </>
                )}

                {/* ===== LOGISTICS (DELIVERY/RECEIPT) RELATIONSHIPS ===== */}
                {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                    <>
                        {/* Origin Order */}
                        {data.sale_order && renderCard('sale_order', data.sale_order as number, 'Nota de Venta Origen', String(data.sale_order_display_id || data.sale_order_number || `NV-${data.sale_order}`), <ShoppingBag className="h-5 w-5" />, 'primary')}
                        {data.purchase_order && renderCard('purchase_order', data.purchase_order as number, 'Orden de Compra Origen', String(data.purchase_order_display_id || data.purchase_order_number || `OCS-${data.purchase_order}`), <FileText className="h-5 w-5" />, 'primary')}

                        {/* Invoices */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('invoice', inv.id, inv.type_display || 'Factura', String(inv.display_id || inv.number || ''), <Receipt className="h-5 w-5" />, 'success'))}

                        {/* Journal Entry */}
                        {data.journal_entry && renderCard('journal_entry', (typeof data.journal_entry === 'object' ? data.journal_entry.id : data.journal_entry) as string | number, 'Asiento Contable', String(data.journal_entry_display_id || `AS-${(typeof data.journal_entry === 'object' ? data.journal_entry.number : data.journal_entry_number || data.journal_entry)}`), <Hash className="h-5 w-5" />, 'primary')}
                    </>
                )}

                {/* ===== PURCHASE ORDER RELATIONSHIPS ===== */}
                {currentType === 'purchase_order' && (
                    <>
                        {/* Work Order Origin */}
                        {data.work_order && renderCard('work_order', data.work_order as number, 'Orden de Trabajo Origen', String(data.work_order_display_id || `OT-${data.work_order_number || data.work_order}`), <ClipboardList className="h-5 w-5" />, 'accent')}

                        {/* Invoices (primary invoices only) */}
                        {(relatedDocs.invoices || []).map((inv: RelatedDocument) => renderCard('invoice', inv.id, inv.type_display || 'Factura', String(inv.display_id || inv.number || ''), <Receipt className="h-5 w-5" />, 'success'))}

                        {/* Notes (NC/ND) */}
                        {(relatedDocs.notes || []).map((note: RelatedDocument) => renderCard('invoice', note.id, note.type_display || 'Nota', String(note.display_id || note.number || ''), <Receipt className="h-5 w-5" />, 'warning'))}

                        {/* Receipts */}
                        {(relatedDocs.receipts || []).map((rec: RelatedDocument) => {
                            // Handle both stock moves and service receipts
                            if (rec.docType === 'inventory') {
                                return renderCard('inventory', rec.id, 'Movimiento de Inventario', String(rec.display_id || rec.number || ''), <Package className="h-5 w-5" />, 'primary');
                            } else {
                                return renderCard('purchase_receipt', rec.id, 'Recepción', String(rec.display_id || rec.number || ''), <Package className="h-5 w-5" />, 'warning');
                            }
                        })}
 
                        {/* Payments */}
                        {(relatedDocs.payments || []).map((pay: RelatedDocument) => renderCard('payment', pay.id, `Pago - ${pay.payment_method_display || pay.method || ''}`, String(pay.display_id || pay.code || ''), <Banknote className="h-5 w-5" />, 'success'))}
                    </>
                )}

                {/* ===== PAYMENT RELATIONSHIPS ===== */}
                {currentType === 'payment' && (
                    <>
                        {/* Unified Document Info from Backend */}
                        {data.document_info && renderCard(
                            data.document_info.type as TransactionType,
                            data.document_info.id, 
                            'Documento Vinculado', 
                            String(data.document_info.label || data.document_info.display_id || ''), 
                            data.document_info.type === 'invoice' ? <Receipt className="h-5 w-5" /> : 
                            data.document_info.type === 'journal_entry' ? <Hash className="h-5 w-5" /> :
                            <ShoppingBag className="h-5 w-5" />,
                            data.document_info.type === 'invoice' ? 'success' : 
                            data.document_info.type === 'journal_entry' ? 'accent' : 'primary'
                        )}

                        {/* Fallback Legacy Fields if document_info is somehow missing or needs specific display */}
                        {!data.document_info && (
                            <>
                                {data.invoice && renderCard('invoice', data.invoice, 'DTE Vinculado', String(data.invoice_display_id || (data.invoice_number ? `FAC-${data.invoice_number}` : `FAC-${data.invoice}`)), <Receipt className="h-5 w-5" />, 'success')}
                                {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta', String(data.sale_order_display_id || data.sale_order_number || `NV-${data.sale_order}`), <ShoppingBag className="h-5 w-5" />, 'primary')}
                                {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra', String(data.purchase_order_display_id || data.purchase_order_number || `OCS-${data.purchase_order}`), <FileText className="h-5 w-5" />, 'primary')}
                            </>
                        )}
                    </>
                )}

                {/* ===== COMMON: JOURNAL ENTRY ===== */}
                {data.journal_entry && renderCard('journal_entry', (typeof data.journal_entry === 'object' ? data.journal_entry.id : data.journal_entry) as string | number, 'Asiento Contable', String(data.journal_entry_display_id || `AS-${(typeof data.journal_entry === 'object' ? data.journal_entry.number : data.journal_entry_number || data.journal_entry)}`), <Hash className="h-5 w-5" />, 'primary')}
            </div>

        </div>
    );
})

RelatedDocumentsSection.displayName = "RelatedDocumentsSection"
