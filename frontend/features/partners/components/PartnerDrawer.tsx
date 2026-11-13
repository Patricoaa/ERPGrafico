"use client"

import { useMemo, useState } from "react"
import { Handshake, PieChart, TrendingUp, Landmark, ArrowRightLeft, Link2 } from "lucide-react"
import { Drawer, DrawerLayout, SkeletonShell, DataCell, toMenuItems } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDrawerIdentity } from "@/features/_shared"
import { EntitySidebar } from "@/features/comments"
import { DocumentRelationsTab } from "@/features/documents"
import { usePartners } from "@/features/contacts"
import { formatPlainDate } from "@/lib/utils"
import { usePartnerOverview } from "../hooks"
import { partnerMenuActions } from "./partnerActions"
import { usePartnerActions } from "./PartnerActionModal"
import { PartnerDistributionsPanel } from "./PartnerDistributionsPanel"
import { PartnerSummaryPanel } from "./PartnerSummaryPanel"
import { PartnerCapitalPanel } from "./PartnerCapitalPanel"
import { PartnerCapitalMovementsPanel } from "./PartnerCapitalMovementsPanel"

interface PartnerDrawerProps {
    /** Id del contacto-socio. */
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Ficha del socio (`contacts.partner`, ADR-0132/0133): resumen, capital (composición), movimientos de capital, distribuciones
 * y relaciones (contacto, asientos y distribuciones, vía el proveedor `contacts.partner`).
 * Las acciones salen de `partnerActionsFor`, la misma fuente que la fila de la lista.
 */
export function PartnerDrawer({ id, open, onOpenChange, onSuccess }: PartnerDrawerProps) {
    const { partners, isLoading } = usePartners()
    const partner = useMemo(() => partners.find(p => p.id === id), [partners, id])
    const [activeTab, setActiveTab] = useState("summary")
    const { run, host } = usePartnerActions({
        onDemoted: () => { onSuccess?.(); onOpenChange(false) },
    })

    const identity = useDrawerIdentity("contacts.partner", "view", partner ?? (id ? { id } : undefined), { printable: false })
    // Misma query que los paneles (mismo key): sin petición extra.
    const { data: overview } = usePartnerOverview(partner ? id : null)
    const taxId = overview?.info.tax_id || partner?.tax_id
    const since = overview?.info.partner_since
    const subtitle = taxId
        ? (since ? `RUT ${taxId} · socio desde ${formatPlainDate(since)}` : `RUT ${taxId}`)
        : identity.subtitle

    // Menú "⋯" con todas las acciones del socio; la baja bloqueada sigue visible, deshabilitada y con su motivo.
    const menuActions = partner ? partnerMenuActions(partner, { run }) : []
    const headerActions = menuActions.length > 0
        ? <DataCell.ActionMenu items={toMenuItems(menuActions)} title="Acciones" align="end" />
        : undefined

    return (
        <Drawer
            fillContent
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            icon={identity.icon ?? Handshake}
            title={identity.title}
            subtitle={subtitle}
            headerActions={headerActions}
            defaultSize={formDrawerWidth("complex", true)}
            contentClassName="p-0"
            mode="view"
        >
            <SkeletonShell isLoading={isLoading && !partner} ariaLabel="Cargando ficha del socio" className="flex-1 flex flex-col h-full">
                {partner && id ? (
                    <DrawerLayout
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        rightRail={<EntitySidebar entityId={id} entityType="contact" />}
                        rightRailCollapsible
                        rightRailStorageKey="erpgrafico.drawer.sidebar.partner"
                        className="min-w-0 h-full overflow-hidden"
                        tabs={[
                            { value: "summary", label: "Resumen", icon: TrendingUp, content: <PartnerSummaryPanel partner={partner} onGoToTab={setActiveTab} /> },
                            { value: "capital", label: "Capital", icon: Landmark, content: <PartnerCapitalPanel partner={partner} run={run} /> },
                            { value: "movements", label: "Movimientos de capital", icon: ArrowRightLeft, content: <PartnerCapitalMovementsPanel partner={partner} /> },
                            { value: "distributions", label: "Utilidades", icon: PieChart, noPadding: true, content: <PartnerDistributionsPanel partnerId={id} /> },
                            { value: "relations", label: "Relaciones", icon: Link2, content: <DocumentRelationsTab label="contacts.partner" id={id} sectionActions={{}} rowActions={() => []} /> },
                        ]}
                    />
                ) : (
                    <p className="p-6 text-sm text-muted-foreground">Este contacto no es un socio de la sociedad.</p>
                )}
            </SkeletonShell>
            {host}
        </Drawer>
    )
}
