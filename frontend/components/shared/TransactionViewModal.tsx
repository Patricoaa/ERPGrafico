"use client"

import React, { useState, useEffect, Fragment } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { Loader2, FileText, ShoppingBag, Receipt, Banknote, Hash, Package, Eye, ArrowLeft, Building2, User, Paperclip, History, Plus, Save, Edit, X, Trash2, ClipboardList, Calendar, Printer, Minus, MonitorSmartphone, CalendarClock, CalendarDays, BookOpen, ArrowRightFromLine, ArrowRightToLine, Wallet, Activity, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { translateStatus, translatePaymentMethod, translateReceivingStatus, formatCurrency, formatPlainDate, cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { Progress } from "@/components/ui/progress"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { AttachmentList } from "./AttachmentList"
import { useRouter } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

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
    // Payment-specific status handling
    if (type === 'payment' || type === 'cash_movement') {
        const variant = status === 'RECONCILED' || status === 'POSTED' ? 'default' :
            status === 'PENDING' ? 'secondary' : 'outline'
        return (
            <Badge variant={variant} className="font-bold text-xs px-3 py-1 uppercase tracking-wider">
                {translateStatus(status)}
            </Badge>
        )
    }

    // General status handling
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
    // Fallback icon if none provided
    const DisplayIcon = Icon || Minus
    return (
        <div className={`space-y-0.5 ${className}`}>
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <DisplayIcon className="h-3 w-3" />
                {label}
            </h4>
            <div className="text-[13px] font-medium text-foreground truncate">
                {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
            </div>
        </div>
    )
}

const SidebarSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3 pt-5 first:pt-0">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-border/80 pb-2">{title}</h3>
        <div className="space-y-3">
            {children}
        </div>
    </div>
)

const SidebarContent = ({ data, currentType, closeModal }: { data: any, currentType: string, closeModal: () => void }) => {
    if (!data) return null
    const router = useRouter()
    const { openContact } = useGlobalModals()

    const renderStatusSection = () => (
        <SidebarSection title="Estado">
            <BannerStatus status={data.status || data.state} type={currentType} />
        </SidebarSection>
    )

    // Document-specific sidebar content
    const renderContent = () => {
        // Helper to render the common contact section
        const renderContactSection = (title: string, name: string, contactId?: number | string | null, rut?: string) => {
            if (!name) return null
            return (
                <SidebarSection title={title}>
                    <div className="space-y-0.5">
                        <div
                            className="text-[13px] font-medium text-foreground leading-tight flex items-center gap-1.5 group cursor-pointer hover:text-primary transition-colors pr-2"
                            onClick={() => {
                                if (contactId) {
                                    openContact(Number(contactId));
                                }
                            }}
                        >
                            <span className="truncate">{name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {rut && <div className="text-[11px] font-medium text-muted-foreground">{rut}</div>}
                    </div>
                </SidebarSection>
            )
        }

        switch (currentType) {
            case 'sale_order':
                return (
                    <>
                        {renderContactSection('Cliente', data.customer_name || data.contact_name, data.customer_id || data.customer || data.contact_id, data.customer_rut)}
                        <SidebarSection title="Información Comercial">
                            <MetadataItem label="Vendedor" value={data.salesperson_name || data.seller_name} icon={User} />
                            <MetadataItem label="Canal" value={data.channel === 'POS' ? 'Punto de Venta' : 'Sistema'} icon={MonitorSmartphone} />
                            <MetadataItem label="Almacén" value={data.warehouse_name} icon={Package} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Emisión" value={formatPlainDate(data.date)} icon={Calendar} />
                            <MetadataItem label="Entrega Planificada" value={formatPlainDate(data.planned_delivery_date)} icon={CalendarClock} />
                        </SidebarSection>
                    </>
                )
            case 'purchase_order':
                return (
                    <>
                        {renderContactSection('Proveedor', data.supplier_name || data.contact_name, data.supplier_id || data.supplier || data.contact_id, data.supplier_rut)}
                        <SidebarSection title="Información de Compra">
                            <MetadataItem label="Almacén Destino" value={data.warehouse_name} icon={Package} />
                            <MetadataItem label="Estado Recepción" value={data.delivery_status && translateReceivingStatus(data.delivery_status)} icon={Activity} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Emisión" value={formatPlainDate(data.date)} icon={Calendar} />
                            <MetadataItem label="Recepción Planificada" value={formatPlainDate(data.planned_receipt_date)} icon={CalendarClock} />
                        </SidebarSection>
                    </>
                )
            case 'invoice':
                const isSale = data.dte_type === 'FACTURA' || data.dte_type === 'BOLETA' || data.dte_type === 'NOTA_DEBITO' || data.dte_type === 'NOTA_CREDITO'
                const contactTitle = data.supplier_name || (data.dte_type === 'PURCHASE_INV' || data.dte_type === 'FACTURA_COMPRA') ? 'Proveedor' : 'Cliente'
                const contactName = data.supplier_name || data.customer_name || data.partner_name || data.contact_name
                const currContactId = data.supplier_id || data.customer_id || data.partner_id || data.contact_id
                const contactRut = data.supplier_rut || data.customer_rut

                return (
                    <>
                        {renderContactSection(contactTitle, contactName, currContactId, contactRut)}
                        <SidebarSection title="Información Tributaria">
                            <MetadataItem label="Tipo DTE" value={data.dte_type} icon={Receipt} />
                            <MetadataItem label="Folio" value={data.folio_number} icon={Hash} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Emisión" value={formatPlainDate(data.date)} icon={Calendar} />
                        </SidebarSection>
                        {data.attachments?.length > 0 && (
                            <SidebarSection title="Archivos">
                                <AttachmentList attachments={data.attachments} />
                            </SidebarSection>
                        )}
                    </>
                )
            case 'payment':
                const payTitle = data.payment_type === 'INBOUND' ? 'Cliente' : 'Proveedor'
                const payName = data.partner_name || data.contact_name
                const payContactId = data.partner_id || data.contact_id
                return (
                    <>
                        {renderContactSection(payTitle, payName, payContactId)}
                        <SidebarSection title="Información de Pago">
                            <MetadataItem label="Método" value={translatePaymentMethod(data.payment_method)} icon={Wallet} />
                            <MetadataItem label="Referencia" value={data.reference || data.transaction_number || data.payment_reference} icon={FileText} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Fecha Pago" value={formatPlainDate(data.date)} icon={Calendar} />
                        </SidebarSection>
                    </>
                )
            case 'journal_entry':
                return (
                    <>
                        {renderContactSection('Entidad Relacionada', data.partner_name || data.contact_name, data.partner_id || data.partner || data.contact_id)}
                        <SidebarSection title="Información Contable">
                            <MetadataItem label="Período" value={data.period_name} icon={CalendarDays} />
                            <MetadataItem label="Diario" value={data.journal_name} icon={BookOpen} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Fecha" value={formatPlainDate(data.date)} icon={Calendar} />
                        </SidebarSection>
                    </>
                )
            case 'cash_movement':
                return (
                    <>
                        {renderContactSection('Entidad', data.partner_name || data.contact_name, data.partner_id || data.partner || data.contact_id)}
                        <SidebarSection title="Información del Movimiento">
                            <MetadataItem label="Tipo" value={data.movement_type} icon={Activity} />
                            <MetadataItem label="Origen" value={data.from_container_name} icon={ArrowRightFromLine} />
                            <MetadataItem label="Destino" value={data.to_container_name} icon={ArrowRightToLine} />
                        </SidebarSection>
                        <SidebarSection title="Fechas">
                            <MetadataItem label="Fecha" value={formatPlainDate(data.date)} icon={Calendar} />
                        </SidebarSection>
                    </>
                )
            case 'work_order':
                return (
                    <>
                        {renderContactSection('Cliente', data.customer_name || data.contact_name, data.customer_id || data.contact_id)}
                        <SidebarSection title="Progreso">
                            <div className="flex items-center gap-3">
                                <Progress value={data.production_progress || 0} className="h-2 flex-1" />
                                <span className="font-black text-xs">{Math.round(data.production_progress || 0)}%</span>
                            </div>
                        </SidebarSection>
                        <SidebarSection title="Información General">
                            <MetadataItem label="Fecha" value={formatPlainDate(data.date || data.created_at)} icon={Calendar} />
                            <MetadataItem label="ID" value={data.display_id || data.id} className="font-mono text-[11px]" icon={Hash} />
                        </SidebarSection>
                    </>
                )
            case 'sale_delivery':
            case 'purchase_receipt':
                const logisticsTitle = currentType === 'sale_delivery' ? 'Cliente' : 'Proveedor'
                const logisticsName = data.customer_name || data.supplier_name || data.contact_name
                const logisticsContactId = data.customer_id || data.customer || data.supplier_id || data.supplier || data.contact_id
                return (
                    <>
                        {renderContactSection(logisticsTitle, logisticsName, logisticsContactId)}
                        <SidebarSection title="Logística">
                            <MetadataItem label="Fecha Esperada" value={formatPlainDate(data.expected_date || data.scheduled_date || data.date)} icon={CalendarClock} />
                        </SidebarSection>
                    </>
                )
            default:
                return (
                    <SidebarSection title="Información General">
                        <MetadataItem label="Fecha" value={formatPlainDate(data.date || data.created_at)} icon={Calendar} />
                        <MetadataItem label="ID" value={data.id} className="font-mono text-[11px]" icon={Hash} />
                    </SidebarSection>
                )
        }
    }

    return (
        <div className="space-y-8 divide-y divide-border/20">
            {renderStatusSection()}
            {renderContent()}
        </div>
    )
}

const RelatedDocumentsSection = ({ data, currentType, navigateTo }: { data: any, currentType: string, navigateTo: any }) => {
    if (!data) return null;

    const renderCard = (type: string, id: any, title: string, subtitle: string, icon: any, color: string, colorBg: string, colorBorder: string) => (
        <Card key={`${type}-${id}-${title.replace(/\s+/g, '-')}`} className={`border-${colorBorder} bg-${colorBg}/30 hover:opacity-80 transition-all cursor-pointer shadow-sm`} onClick={() => navigateTo(type, id)}>
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

    // Collected documents from related_documents or individual fields
    const relatedDocs = data.related_documents || {};
    const hasAnyDocuments =
        // Invoice documents
        data.sale_order || data.purchase_order || data.corrected_invoice ||
        // Order documents
        relatedDocs.invoices?.length > 0 || relatedDocs.notes?.length > 0 ||
        relatedDocs.deliveries?.length > 0 || relatedDocs.receipts?.length > 0 ||
        relatedDocs.payments?.length > 0 ||
        // Invoice-specific
        data.related_returns?.length > 0 || data.adjustments?.length > 0 ||
        data.work_orders?.length > 0 || data.related_stock_moves?.length > 0 ||
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
                        {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta Origen', `NV-${data.sale_order_number || data.sale_order}`, <ShoppingBag className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                        {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra Origen', `OCS-${data.purchase_order_number || data.purchase_order}`, <FileText className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}

                        {/* Corrected Invoice */}
                        {data.corrected_invoice && renderCard('invoice', data.corrected_invoice.id, 'Documento Rectificado', data.corrected_invoice.display_id, <Receipt className="h-5 w-5 text-amber-600" />, 'amber', 'amber-50', 'amber-200')}

                        {/* Adjustments (NC/ND that correct THIS invoice) */}
                        {data.adjustments?.map((adj: any) => renderCard('invoice', adj.id, adj.dte_type_display, adj.display_id, <Receipt className="h-5 w-5 text-amber-600" />, 'amber', 'amber-50', 'amber-200'))}

                        {/* Related Returns (for NC/ND) */}
                        {data.related_returns?.map((ret: any) => renderCard(ret.docType, ret.id, ret.type, ret.display_id, <Package className="h-5 w-5 text-red-600" />, 'red', 'red-50', 'red-200'))}

                        {/* Work Orders (for Debit Notes) */}
                        {data.work_orders?.map((wo: any) => renderCard('work_order', wo.id, 'Orden de Trabajo', wo.number, <ClipboardList className="h-5 w-5 text-indigo-600" />, 'indigo', 'indigo-50', 'indigo-200'))}

                        {/* Stock Moves (for NC/ND) */}
                        {data.related_stock_moves?.map((move: any) => renderCard('inventory', move.id, 'Movimiento de Inventario', move.display_id, <Package className="h-5 w-5 text-purple-600" />, 'purple', 'purple-50', 'purple-200'))}
                    </>
                )}

                {/* ===== SALE ORDER RELATIONSHIPS ===== */}
                {currentType === 'sale_order' && (
                    <>
                        {/* Invoices (primary invoices only) */}
                        {relatedDocs.invoices?.map((inv: any) => renderCard('invoice', inv.id, inv.type_display || 'Factura', inv.number, <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200'))}

                        {/* Notes (NC/ND) */}
                        {relatedDocs.notes?.map((note: any) => renderCard('invoice', note.id, note.type_display, note.number, <Receipt className="h-5 w-5 text-amber-600" />, 'amber', 'amber-50', 'amber-200'))}

                        {/* Deliveries */}
                        {relatedDocs.deliveries?.map((del: any) => renderCard('sale_delivery', del.id, 'Despacho', del.display_id, <Package className="h-5 w-5 text-orange-600" />, 'orange', 'orange-50', 'orange-200'))}

                        {/* Payments */}
                        {relatedDocs.payments?.map((pay: any) => renderCard('payment', pay.id, `Pago - ${pay.payment_method_display || pay.method}`, pay.code, <Banknote className="h-5 w-5 text-green-600" />, 'green', 'green-50', 'green-200'))}
                    </>
                )}

                {/* ===== LOGISTICS (DELIVERY/RECEIPT) RELATIONSHIPS ===== */}
                {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                    <>
                        {/* Origin Order */}
                        {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta Origen', data.sale_order_display_id || data.sale_order_number || `NV-${data.sale_order}`, <ShoppingBag className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                        {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra Origen', data.purchase_order_display_id || data.purchase_order_number || `OCS-${data.purchase_order}`, <FileText className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}

                        {/* Invoices */}
                        {relatedDocs.invoices?.map((inv: any) => renderCard('invoice', inv.id, inv.type_display || 'Factura', inv.display_id || inv.number, <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200'))}

                        {/* Journal Entry */}
                        {data.journal_entry && renderCard('journal_entry', data.journal_entry, 'Asiento Contable', data.journal_entry_display_id || `AS-${data.journal_entry_number || data.journal_entry}`, <Hash className="h-5 w-5 text-purple-600" />, 'purple', 'purple-50', 'purple-200')}
                    </>
                )}

                {/* ===== PURCHASE ORDER RELATIONSHIPS ===== */}
                {currentType === 'purchase_order' && (
                    <>
                        {/* Work Order Origin */}
                        {data.work_order && renderCard('work_order', data.work_order, 'Orden de Trabajo Origen', data.work_order_display_id || `OT-${data.work_order_number || data.work_order}`, <ClipboardList className="h-5 w-5 text-indigo-600" />, 'indigo', 'indigo-50', 'indigo-200')}

                        {/* Invoices (primary invoices only) */}
                        {relatedDocs.invoices?.map((inv: any) => renderCard('invoice', inv.id, inv.type_display || 'Factura', inv.display_id || inv.number, <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200'))}

                        {/* Notes (NC/ND) */}
                        {relatedDocs.notes?.map((note: any) => renderCard('invoice', note.id, note.type_display, note.display_id || note.number, <Receipt className="h-5 w-5 text-amber-600" />, 'amber', 'amber-50', 'amber-200'))}

                        {/* Receipts */}
                        {relatedDocs.receipts?.map((rec: any) => {
                            // Handle both stock moves and service receipts
                            if (rec.docType === 'inventory') {
                                return renderCard('inventory', rec.id, 'Movimiento de Inventario', rec.display_id || rec.number, <Package className="h-5 w-5 text-purple-600" />, 'purple', 'purple-50', 'purple-200');
                            } else {
                                return renderCard('purchase_receipt', rec.id, 'Recepción', rec.display_id || rec.number, <Package className="h-5 w-5 text-orange-600" />, 'orange', 'orange-50', 'orange-200');
                            }
                        })}

                        {/* Payments */}
                        {relatedDocs.payments?.map((pay: any) => renderCard('payment', pay.id, `Pago - ${pay.payment_method_display || pay.method}`, pay.display_id || pay.code, <Banknote className="h-5 w-5 text-green-600" />, 'green', 'green-50', 'green-200'))}
                    </>
                )}

                {/* ===== PAYMENT RELATIONSHIPS ===== */}
                {currentType === 'payment' && (
                    <>
                        {/* Unified Document Info from Backend */}
                        {data.document_info && renderCard(
                            data.document_info.type, 
                            data.document_info.id, 
                            'Documento Vinculado', 
                            data.document_info.label || data.document_info.display_id, 
                            data.document_info.type === 'invoice' ? <Receipt className="h-5 w-5 text-emerald-600" /> : 
                            data.document_info.type === 'journal_entry' ? <Hash className="h-5 w-5 text-purple-600" /> :
                            <ShoppingBag className="h-5 w-5 text-blue-600" />,
                            data.document_info.type === 'invoice' ? 'emerald' : 
                            data.document_info.type === 'journal_entry' ? 'purple' : 'blue',
                            data.document_info.type === 'invoice' ? 'emerald-50' : 
                            data.document_info.type === 'journal_entry' ? 'purple-50' : 'blue-50',
                            data.document_info.type === 'invoice' ? 'emerald-200' : 
                            data.document_info.type === 'journal_entry' ? 'purple-200' : 'blue-200'
                        )}

                        {/* Fallback Legacy Fields if document_info is somehow missing or needs specific display */}
                        {!data.document_info && (
                            <>
                                {data.invoice && renderCard('invoice', data.invoice, 'DTE Vinculado', data.invoice_display_id || (data.invoice_number ? `FAC-${data.invoice_number}` : `FAC-${data.invoice}`), <Receipt className="h-5 w-5 text-emerald-600" />, 'emerald', 'emerald-50', 'emerald-200')}
                                {data.sale_order && renderCard('sale_order', data.sale_order, 'Nota de Venta', data.sale_order_display_id || data.sale_order_number || `NV-${data.sale_order}`, <ShoppingBag className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                                {data.purchase_order && renderCard('purchase_order', data.purchase_order, 'Orden de Compra', data.purchase_order_display_id || data.purchase_order_number || `OCS-${data.purchase_order}`, <FileText className="h-5 w-5 text-blue-600" />, 'blue', 'blue-50', 'blue-200')}
                            </>
                        )}
                    </>
                )}

                {/* ===== COMMON: JOURNAL ENTRY ===== */}
                {data.journal_entry && renderCard('journal_entry', data.journal_entry, 'Asiento Contable', data.journal_entry_display_id || `AS-${data.journal_entry_number || data.journal_entry}`, <Hash className="h-5 w-5 text-purple-600" />, 'purple', 'purple-50', 'purple-200')}
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

const PrintableReceipt = ({ data, currentType, mainTitle, subTitle, onClose, isPreview = false }: { data: any, currentType: string, mainTitle: string, subTitle: string, onClose?: () => void, isPreview?: boolean }) => {
    if (!data) return null

    const renderHeader = () => (
        <div className="text-center space-y-1 mb-4 border-b-2 border-black pb-4">
            <h1 className="text-sm font-black uppercase tracking-widest leading-tight">{mainTitle}</h1>
            <h2 className="text-lg font-black font-mono tracking-tighter">{subTitle}</h2>
            <p className="text-[10px] font-bold uppercase text-black/60">{formatPlainDate(data.date || data.created_at)}</p>
        </div>
    )

    const renderContextualInfo = () => {
        const contactName = data.customer_name || data.supplier_name || data.partner_name || data.contact_name
        const contactRut = data.customer_rut || data.supplier_rut || data.partner_rut

        return (
            <div className="space-y-4 mb-4 text-[11px] leading-tight">
                {/* Contact Section */}
                {contactName && (
                    <div className="border-b border-black/10 pb-2">
                        <div className="font-black uppercase text-[9px] text-black/50">Asociado a:</div>
                        <div className="font-bold uppercase tracking-tight">{contactName}</div>
                        {contactRut && <div className="font-mono text-[10px] opacity-70">{contactRut}</div>}
                    </div>
                )}

                {/* Specific Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {currentType === 'sale_order' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Vendedor:</span> {data.salesperson_name || 'N/A'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Canal:</span> {data.channel || 'SISTEMA'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado:</span> {translateStatus(data.status)}</div>
                        </>
                    )}
                    {currentType === 'invoice' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo DTE:</span> {data.dte_type}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Folio:</span> {data.folio_number || 'S/N'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Vencimiento:</span> {formatPlainDate(data.due_date)}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado Pago:</span> {data.payment_status}</div>
                        </>
                    )}
                    {currentType === 'payment' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Método:</span> {translatePaymentMethod(data.payment_method)}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {data.transaction_number || data.reference || '-'}</div>
                            {data.invoice_display_id && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Documento Relacionado:</span> {data.invoice_display_id}</div>}
                        </>
                    )}
                    {(currentType === 'sale_delivery' || currentType === 'purchase_receipt') && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Almacén:</span> {data.warehouse_name || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Estado:</span> {translateReceivingStatus(data.status)}</div>
                            {data.origin_document && <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Origen:</span> {data.origin_document}</div>}
                        </>
                    )}
                    {currentType === 'journal_entry' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Diario:</span> {data.journal_name || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Periodo:</span> {data.period_name || '-'}</div>
                            <div className="col-span-2"><span className="font-black uppercase text-[8px] text-black/40 block">Referencia:</span> {data.reference || '-'}</div>
                        </>
                    )}
                    {currentType === 'inventory' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Tipo:</span> {data.move_type_display || '-'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Origen/Destino:</span> {data.warehouse_name || '-'}</div>
                        </>
                    )}
                    {currentType === 'cash_movement' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Origen:</span> {data.from_container_name || 'Ext.'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Destino:</span> {data.to_container_name || 'Ext.'}</div>
                        </>
                    )}
                    {currentType === 'work_order' && (
                        <>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Prioridad:</span> {data.priority || 'BAJA'}</div>
                            <div><span className="font-black uppercase text-[8px] text-black/40 block">Progreso:</span> {data.completion_percentage}%</div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    const renderItemsTable = () => {
        const lines = data.lines || data.items || []
        if (lines.length === 0) return null

        // Accounting specific table
        if (currentType === 'journal_entry') {
            return (
                <div className="mb-4">
                    <div className="grid grid-cols-[1fr,60px,60px] gap-1 border-b-2 border-black pb-1 mb-1 text-[8px] font-black uppercase tracking-widest">
                        <div>Cuenta</div>
                        <div className="text-right">Debe</div>
                        <div className="text-right">Haber</div>
                    </div>
                    <div className="space-y-2">
                        {lines.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,60px,60px] gap-1 text-[9px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{item.account_name}</span>
                                    <span className="text-[7px] font-mono text-black/40">{item.account_code}</span>
                                </div>
                                <div className="text-right font-mono">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</div>
                                <div className="text-right font-mono">{Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        // Logistics specific table (PrintableReceipt)
        if (currentType === 'sale_delivery' || currentType === 'purchase_receipt') {
            const isOutbound = currentType === 'sale_delivery';
            return (
                <div className="mb-4">
                    <div className="grid grid-cols-[1fr,40px,50px] gap-2 border-b-2 border-black pb-1 mb-1 text-[8px] font-black uppercase tracking-widest">
                        <div>Producto</div>
                        <div className="text-right">Cant</div>
                        <div className="text-center">UOM</div>
                    </div>
                    <div className="space-y-2">
                        {lines.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="grid grid-cols-[1fr,40px,50px] gap-2 text-[10px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{item.product_name || item.product?.name}</span>
                                    {item.product_code && <span className="text-[7px] font-mono text-black/40 uppercase">{item.product_code}</span>}
                                </div>
                                <div className="text-right font-black font-mono">
                                    {isOutbound ? `-${Math.round(item.quantity || 0)}` : `+${Math.round(item.quantity || 0)}`}
                                </div>
                                <div className="text-center font-bold text-[8px] uppercase text-black/60 pt-0.5">
                                    {item.uom_name || item.uom?.name || 'UN'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        return (
            <div className="mb-4">
                <div className="grid grid-cols-[1fr,30px,50px,40px,60px] gap-1 border-b-2 border-black pb-1 mb-1 text-[7px] font-black uppercase tracking-widest">
                    <div>Descripción</div>
                    <div className="text-center">Cant</div>
                    <div className="text-right">P. Unit</div>
                    <div className="text-right">Desc.</div>
                    <div className="text-right">Total</div>
                </div>
                <div className="space-y-2">
                    {lines.map((line: any, idx: number) => {
                        const hasDiscount = parseFloat(line.discount_amount || 0) > 0;
                        return (
                            <div key={line.id || idx} className="grid grid-cols-[1fr,30px,50px,40px,60px] gap-1 text-[9px] leading-tight border-b border-black/5 pb-1">
                                <div className="font-bold flex flex-col">
                                    <span>{line.description || line.product_name}</span>
                                    {line.product_code && <span className="text-[7px] font-mono text-black/40 uppercase">{line.product_code}</span>}
                                </div>
                                <div className="text-center font-mono">{Math.round(line.quantity || 0)}</div>
                                <div className="text-right font-mono">{formatCurrency(line.unit_price_gross || line.unit_price || line.unit_cost)}</div>
                                <div className="text-right font-mono text-black/60">{hasDiscount ? `-${formatCurrency(line.discount_amount)}` : '-'}</div>
                                <div className="text-right font-black font-mono">
                                    {formatCurrency(line.subtotal || line.amount || (line.unit_price * line.quantity) || 0)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const renderTotals = () => {
        if (currentType === 'payment' || currentType === 'cash_movement') {
            return (
                <div className="border-t-2 border-black pt-4 text-center">
                    <div className="text-[10px] font-black uppercase text-black/50 tracking-widest">Total Movimiento</div>
                    <div className="text-2xl font-black font-mono tracking-tighter">{formatCurrency(data.amount)}</div>
                </div>
            )
        }

        if (currentType === 'journal_entry') {
            const lines = data.lines || data.items || []
            const totalDebit = lines.reduce((acc: number, cur: any) => acc + Number(cur.debit), 0)
            const totalCredit = lines.reduce((acc: number, cur: any) => acc + Number(cur.credit), 0)

            return (
                <div className="border-t-2 border-black pt-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="uppercase">Total Debe:</span>
                        <span className="font-mono">{formatCurrency(totalDebit)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="uppercase">Total Haber:</span>
                        <span className="font-mono">{formatCurrency(totalCredit)}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-black/20 flex justify-center">
                        <span className="text-[8px] font-black uppercase text-black/40">Asiento Cuadrado</span>
                    </div>
                </div>
            )
        }

        if (!data.total && !data.amount) return null

        const totalValue = data.total || data.amount

        return (
            <div className="border-t-2 border-black pt-2 space-y-1">
                {data.total_net !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">Subtotal Neto:</span>
                        <span className="font-mono">{formatCurrency(data.total_net || 0)}</span>
                    </div>
                )}
                {data.total_tax !== undefined && (
                    <div className="flex justify-between text-[9px] font-bold opacity-60">
                        <span className="uppercase tracking-wider">IVA (19%):</span>
                        <span className="font-mono">{formatCurrency(data.total_tax || 0)}</span>
                    </div>
                )}
                {parseFloat(data.total_discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-[9px] font-black text-red-600">
                        <span className="uppercase tracking-wider">Descuento Global:</span>
                        <span className="font-mono">-{formatCurrency(data.total_discount_amount)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-black/20">
                    <span className="text-xs font-black uppercase tracking-tight">Total Final:</span>
                    <span className="text-xl font-black font-mono tracking-tighter">{formatCurrency(totalValue)}</span>
                </div>
            </div>
        )
    }

    return (
        <div className={cn(
            "print:block w-[80mm] mx-auto bg-white text-black font-sans relative",
            isPreview ? "block p-6 rounded-2xl shadow-2xl border border-black/5" : "hidden p-4"
        )}>
            {/* Close button for preview */}
            {onClose && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-lg border border-black/10 hover:bg-black/5 print:hidden group z-10"
                >
                    <X className="h-4 w-4 text-black group-hover:scale-110 transition-transform" />
                </Button>
            )}

            {renderHeader()}
            {renderContextualInfo()}
            {renderItemsTable()}
            {renderTotals()}

            <div className="mt-8 text-center space-y-2 border-t border-black/10 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">Gracias por su preferencia</p>
                <p className="text-[8px] font-mono text-black/20 italic">Generado por ERPGrafico</p>
            </div>

            {/* Print button inside preview */}
            {isPreview && (
                <div className="mt-6 pt-6 border-t border-dashed border-black/20 flex justify-center print:hidden">
                    <Button
                        onClick={() => window.print()}
                        className="bg-black text-white hover:bg-black/90 font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl shadow-lg border-2 border-black"
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Ahora
                    </Button>
                </div>
            )}
        </div>
    )
}

export function TransactionViewModal({ open, onOpenChange, type: initialType, id: initialId, view = 'all' }: TransactionViewModalProps) {
    const [history, setHistory] = useState<{ type: string, id: number | string }[]>([])
    const [currentType, setCurrentType] = useState<any>(initialType)
    const [currentId, setCurrentId] = useState<number | string>(initialId)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [editingPayment, setEditingPayment] = useState<any>(null)
    const [showReceiptPreview, setShowReceiptPreview] = useState(false)

    const handlePrint = () => {
        setShowReceiptPreview(true)
    }

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
            setShowReceiptPreview(false)
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

        } catch (error: any) {
            console.error("Error fetching transaction details:", error)
            const msg = error.response?.data?.error || error.message || "Error desconocido"
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
                title={mainTitle + (subTitle ? ` - ${subTitle}` : "")}
                headerClassName="sr-only"
                size="xl"
                hideScrollArea={true}
                className="overflow-hidden p-0 gap-0 print:border-none print:shadow-none print:bg-white print:text-black"
            >
                {/* Simplified Overlay for Receipts - As per user request */}
                {showReceiptPreview && (
                    <div className="fixed inset-0 z-[110] bg-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
                        <div className="w-full max-w-[400px] animate-in zoom-in-95 duration-200">
                            <PrintableReceipt
                                data={data}
                                currentType={currentType}
                                mainTitle={mainTitle}
                                subTitle={subTitle}
                                onClose={() => setShowReceiptPreview(false)}
                                isPreview={true}
                            />
                        </div>
                    </div>
                )}

                {/* Standard hidden receipt for actual browser print command */}
                <PrintableReceipt
                    data={data}
                    currentType={currentType}
                    mainTitle={mainTitle}
                    subTitle={subTitle}
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

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 print:hidden">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrint}
                                className="font-bold border-2 hover:bg-primary hover:text-primary-foreground gap-2 transition-all rounded-xl h-10 px-4"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir
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
                                                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px]">Cantidad</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[100px]">UOM</TableHead>
                                                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Tipo</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {(data.lines || []).map((line: any) => {
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
                                                                                        <span className="text-orange-600 bg-orange-600/10 px-2 py-1 rounded-md">Salida</span>
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
                                                                    {(data.lines || data.items || []).map((item: any, idx: number) => {
                                                                        const hasLineDiscount = parseFloat(item.discount_amount || 0) > 0
                                                                        return (
                                                                            <Fragment key={item.id || idx}>
                                                                                <TableRow className="hover:bg-muted/5 border-border/40">
                                                                                    <TableCell className="px-6 py-4">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-bold text-[13px] tracking-tight leading-tight">{item.description || item.product_name}</span>
                                                                                            <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">{item.product_code}</span>
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-center font-bold text-[13px] font-mono">{Math.round(parseFloat(item.quantity || 0))}</TableCell>
                                                                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">{formatCurrency(item.unit_price_gross || item.unit_price || item.unit_cost)}</TableCell>
                                                                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">
                                                                                        {hasLineDiscount ? (
                                                                                            <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-sm">
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
                                                                <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                                    <span>Suma de Productos:</span>
                                                                    <span className="font-mono text-primary">{formatCurrency((data.lines || data.items || []).reduce((acc: number, item: any) => acc + parseFloat(item.subtotal || 0), 0))}</span>
                                                                </div>

                                                                {parseFloat(data.total_discount_amount || 0) > 0 && (
                                                                    <div className="flex justify-between items-center text-xs font-bold text-red-600 uppercase tracking-wider bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                                                                        <div className="flex items-center gap-2">
                                                                            <Plus className="h-3 w-3 rotate-45" />
                                                                            <span>Descuento Global:</span>
                                                                        </div>
                                                                        <span className="font-mono">-{formatCurrency(data.total_discount_amount)}</span>
                                                                    </div>
                                                                )}

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
