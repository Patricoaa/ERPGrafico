import React from "react"
import { ExternalLink, User, MonitorSmartphone, Package, Calendar, CalendarClock, Receipt, Hash, Wallet, FileText, CalendarDays, BookOpen, ArrowRightFromLine, ArrowRightToLine, Activity, Gavel } from "lucide-react"
import type { TransactionData } from "../TransactionViewModal"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useRouter } from "next/navigation"
import { formatPlainDate, translateReceivingStatus, translatePaymentMethod } from "@/lib/utils"
import { BannerStatus } from "./BannerStatus"
import { MetadataItem } from "./MetadataItem"
import { AttachmentList } from "../AttachmentList"
import { Progress } from "@/components/ui/progress"

export const SidebarSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-3 pt-5 first:pt-0">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-border/80 pb-2">{title}</h3>
        <div className="space-y-3">
            {children}
        </div>
    </div>
)

export const SidebarContent = React.memo(({ data, currentType, closeModal }: { data: TransactionData, currentType: string, closeModal: () => void }) => {
    if (!data) return null
    const router = useRouter()
    const { openContact } = useGlobalModalActions()

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
                            <MetadataItem label="Método" value={translatePaymentMethod(data.payment_method)} icon={data.payment_method === 'WRITE_OFF' ? Gavel : Wallet} />
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
})

SidebarContent.displayName = "SidebarContent"
