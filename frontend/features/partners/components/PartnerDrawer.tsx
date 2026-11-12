"use client"

import { useMemo, useState } from "react"
import { Handshake, History, PieChart, TrendingUp, BookOpen } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { Drawer, DrawerLayout, SkeletonShell, StatCard } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDrawerIdentity } from "@/features/_shared"
import { EntitySidebar } from "@/features/comments"
import { usePartners, netEquityPercentages, type Partner } from "@/features/contacts"
import { usePartnerStakes, useProfitDistributions } from "../hooks"
import { partnerStakeEntity, partnerStakeViews } from "../entity-view/partnerStake.entity"
import { partnerDistributionEntity, partnerDistributionViews, type PartnerDistributionRow } from "../entity-view/partnerDistribution.entity"
import { partnerActions, demoteBlockedReason } from "./partnerActions"
import { usePartnerActionHost } from "./PartnerActionHost"
import { PartnerLedgerPanel } from "./PartnerLedgerPanel"

interface PartnerDrawerProps {
    /** Id del contacto-socio. */
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

function SummaryPanel({ partner, equityPct }: { partner: Partner; equityPct: string }) {
    const blocked = demoteBlockedReason(partner)
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                <StatCard variant="minimal" accent="primary" label="Participación" value={`${equityPct}%`} subtext="sobre capital enterado" />
                <StatCard variant="minimal" accent="muted" label="Capital suscrito" value={money(partner.partner_total_contributions)} />
                <StatCard variant="minimal" accent="success" label="Capital enterado" value={money(partner.partner_total_paid_in)} />
                <StatCard variant="minimal" accent="warning" label="Capital pendiente" value={money(partner.partner_pending_capital)} subtext={Number(partner.partner_excess_capital) > 0 ? `Exceso: ${money(partner.partner_excess_capital)}` : undefined} />
                <StatCard variant="minimal" accent="destructive" label="Retiros provisorios" value={money(partner.partner_provisional_withdrawals_balance)} />
                <StatCard variant="minimal" accent="success" label="Utilidades retenidas" value={money(partner.partner_earnings_balance)} />
                <StatCard variant="minimal" accent="warning" label="Dividendos por pagar" value={money(partner.partner_dividends_payable_balance)} />
                <StatCard variant="minimal" accent="primary" label="Patrimonio neto" value={money(partner.partner_net_equity)} />
            </div>
            {blocked && (
                <p className="text-sm text-muted-foreground">Para dar de baja al socio: {blocked}</p>
            )}
        </div>
    )
}

function StakesPanel({ partnerId }: { partnerId: number }) {
    const { data: stakes = [], isLoading, isError, refetch } = usePartnerStakes(partnerId)
    const collection = useEntityCollection(
        partnerStakeEntity,
        { rows: stakes, isLoading, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <div className="p-4 h-full min-h-0 flex flex-col">
            <Collection.Root collection={collection}>
                <Collection.View table={partnerStakeViews.table} emptyTitle="Sin historial" emptyDescription="Aún no hay vigencias de participación registradas." />
            </Collection.Root>
        </div>
    )
}

function DistributionsPanel({ partnerId }: { partnerId: number }) {
    const { distributions, isLoading, error, refetch } = useProfitDistributions()
    const rows = useMemo<PartnerDistributionRow[]>(() => distributions.flatMap(d =>
        (d.lines ?? []).filter(l => l.partner === partnerId).map(l => ({
            id: l.id,
            distributionId: d.id,
            displayId: d.display_id,
            fiscalYear: d.fiscal_year,
            status: d.status,
            percentage: Number(l.percentage_at_date) || 0,
            gross: Number(l.gross_amount) || 0,
            offset: Number(l.provisional_withdrawals_offset) || 0,
            net: Number(l.net_amount) || 0,
            paid: Number(l.paid_dividend_amount) || 0,
        })),
    ), [distributions, partnerId])
    const collection = useEntityCollection(
        partnerDistributionEntity,
        { rows, isLoading, error: !!error, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <div className="p-4 h-full min-h-0 flex flex-col">
            <Collection.Root collection={collection}>
                <Collection.View table={partnerDistributionViews.table} emptyTitle="Sin distribuciones" emptyDescription="Este socio no participa en ninguna distribución de utilidades." />
            </Collection.Root>
        </div>
    )
}

/**
 * Ficha del socio (`contacts.partner`, ADR-0132): resumen, libro auxiliar, participación y distribuciones.
 * Las acciones salen de `partnerActions`, la misma fuente que la fila de la lista.
 */
export function PartnerDrawer({ id, open, onOpenChange, onSuccess }: PartnerDrawerProps) {
    const { partners, isLoading } = usePartners()
    const partner = useMemo(() => partners.find(p => p.id === id), [partners, id])
    const equityPct = useMemo(() => (id ? netEquityPercentages(partners)[id] ?? "0" : "0"), [partners, id])
    const [activeTab, setActiveTab] = useState("summary")
    const { run, host } = usePartnerActionHost({
        onDemoted: () => { onSuccess?.(); onOpenChange(false) },
    })

    const identity = useDrawerIdentity("contacts.partner", "view", partner ?? (id ? { id } : undefined), { printable: false })
    const headerActions = partner ? partnerActions.render(partner, { run }) : undefined

    return (
        <Drawer
            fillContent
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            icon={identity.icon ?? Handshake}
            title={identity.title}
            subtitle={identity.subtitle}
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
                            { value: "summary", label: "Resumen", icon: TrendingUp, content: <SummaryPanel partner={partner} equityPct={equityPct} /> },
                            { value: "ledger", label: "Libro", icon: BookOpen, noPadding: true, content: <PartnerLedgerPanel partnerId={id} /> },
                            { value: "stakes", label: "Participación", icon: History, noPadding: true, content: <StakesPanel partnerId={id} /> },
                            { value: "distributions", label: "Distribuciones", icon: PieChart, noPadding: true, content: <DistributionsPanel partnerId={id} /> },
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
