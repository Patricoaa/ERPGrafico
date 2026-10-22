"use client"

import {
    CalendarIcon,
    User,
    FileText,
    Wrench,
    Layers,
    Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { WizardSummarySidebar } from "@/components/shared"
import { formatPlainDate, cn } from "@/lib/utils"
import type { WorkOrder } from "../types"

interface WizardRightSidebarProps {
    order: WorkOrder
    productName: string
    stageData: WorkOrder['stage_data']
}

interface SidebarSectionProps {
    icon: React.ComponentType<{ className?: string }>
    title: string
    children: React.ReactNode
    className?: string
}

function SidebarSection({ icon: Icon, title, children, className }: SidebarSectionProps) {
    return (
        <div className={cn("py-4", className)}>
            <div className="pb-3 mb-3 shrink-0 flex items-center gap-2.5 border-b border-border/40">
                <h3 className="text-2xs font-bold uppercase tracking-[0.25em] text-muted-foreground/70 flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    {title}
                </h3>
            </div>
            {children}
        </div>
    )
}

interface InfoRowProps {
    label: string
    value: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
}

function InfoRow({ label, value, icon: Icon }: InfoRowProps) {
    return (
        <div className="flex items-start gap-2 py-1.5">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
                <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground/60 leading-none mb-0.5">{label}</p>
                <p className="text-xs text-foreground leading-snug">{value}</p>
            </div>
        </div>
    )
}

export function WizardRightSidebar({
    order,
    productName,
    stageData,
}: WizardRightSidebarProps) {
    const techSpecs = [
        { label: "Pre-Impresión", value: stageData?.prepress_specs },
        { label: "Diseño", value: stageData?.design_needed ? "Requerido" : null },
        { label: "Folio Inicial", value: stageData?.folio_start },
        { label: "Impresión", value: stageData?.press_specs },
        { label: "Post-Impresión", value: stageData?.postpress_specs },
    ].filter(s => s.value)

    const hasInfo = productName || order?.start_date || order?.sale_order_delivery_date ||
        stageData?.contact_name || order?.sale_customer_name

    return (
        <WizardSummarySidebar
            side="right"
            width="w-64"
            className="hidden lg:flex"
            scrollAreaClassName="min-h-0"
            body={
                <>
                    {/* General Info */}
                    {hasInfo && (
                        <SidebarSection icon={Layers} title="Información">
                            <div className="space-y-0">
                                <InfoRow
                                    icon={Package}
                                    label="Producto"
                                    value={
                                        <span>
                                            {productName}
                                            {order?.product_description && (
                                                <span className="block text-2xs text-muted-foreground/70 italic leading-tight mt-0.5 line-clamp-2">
                                                    {order.product_description}
                                                </span>
                                            )}
                                        </span>
                                    }
                                />
                                {order?.start_date && (
                                    <InfoRow
                                        icon={CalendarIcon}
                                        label="Inicio"
                                        value={formatPlainDate(order.start_date)}
                                    />
                                )}
                                {order?.sale_order_delivery_date && (
                                    <InfoRow
                                        icon={CalendarIcon}
                                        label="Entrega"
                                        value={formatPlainDate(order.sale_order_delivery_date)}
                                    />
                                )}
                                {(stageData?.contact_name || order?.sale_customer_name) && (
                                    <InfoRow
                                        icon={User}
                                        label="Cliente"
                                        value={
                                            <span>
                                                {stageData?.contact_name || order?.sale_customer_name}
                                                {(stageData?.contact_tax_id || order?.sale_customer_rut) && (
                                                    <span className="block text-2xs text-muted-foreground/60 font-mono mt-0.5">
                                                        {stageData?.contact_tax_id || order?.sale_customer_rut}
                                                    </span>
                                                )}
                                            </span>
                                        }
                                    />
                                )}
                            </div>
                        </SidebarSection>
                    )}

                    {/* Technical Specs — always shown */}
                    <SidebarSection icon={Wrench} title="Especificaciones" className={cn(hasInfo && "border-t border-border/20")}>
                        <div className="space-y-0">
                            {order?.prepress_archive && (
                                <div className="mb-3">
                                    <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground/60 mb-1.5 flex items-center gap-1.5">
                                        <FileText className="h-3 w-3" />
                                        Archivo de Diseño
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs h-7"
                                        onClick={() => window.open(order.prepress_archive, '_blank')}
                                    >
                                        Ver Archivo
                                    </Button>
                                </div>
                            )}
                            {techSpecs.map((spec) => (
                                <InfoRow
                                    key={spec.label}
                                    label={spec.label}
                                    value={String(spec.value)}
                                />
                            ))}
                            {!order?.prepress_archive && techSpecs.length === 0 && (
                                <p className="text-3xs text-muted-foreground/50 italic py-1">Sin especificaciones registradas</p>
                            )}
                        </div>
                    </SidebarSection>
                </>
            }
        />
    )
}
