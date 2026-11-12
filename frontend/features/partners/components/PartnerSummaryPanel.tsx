"use client"

import { AlertTriangle, Info, PieChart as PieChartIcon } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState, FormSection, SkeletonShell, StatCard, PieChart, DocumentFieldGrid, type DocumentField } from "@/components/shared"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import type { Partner, PartnerAlertCode, PartnerOverview, PartnerOverviewAlert } from "@/features/contacts"
import { usePartnerOverview } from "../hooks"
import type { PartnerActionRequest, PartnerActionRunner } from "./partnerActionRequest"

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

const ALERT_TITLE: Record<PartnerAlertCode, string> = {
    excess_capital: "Exceso de capital",
    pending_capital: "Capital pendiente",
    dividends_payable: "Dividendos por pagar",
    retained_earnings: "Utilidades retenidas",
}

const ALERT_HINT: Record<PartnerAlertCode, string> = {
    excess_capital: "Hay capital enterado por sobre lo suscrito.",
    pending_capital: "Hay capital suscrito que aún no se entera.",
    dividends_payable: "Hay dividendos acordados sin pagar.",
    retained_earnings: "Hay utilidades retenidas disponibles para distribuir.",
}

const ALERT_BUTTON: Record<PartnerOverviewAlert["action"], string> = {
    subscription: "Formalizar",
    contribution: "Pagar capital",
    dividend: "Pagar dividendos",
    mobilize: "Distribuir",
}

/** La alerta ya trae la acción; aquí solo se traduce a la petición tipada. */
function requestFor(alert: PartnerOverviewAlert, partnerId: number): PartnerActionRequest {
    switch (alert.action) {
        case "subscription": return { type: "subscription", partnerId, amount: alert.amount }
        case "contribution": return { type: "contribution", partnerId, amount: alert.amount }
        case "dividend": return { type: "dividend", partnerId }
        case "mobilize": return { type: "mobilize", partnerId }
    }
}

interface PartnerSummaryPanelProps {
    partner: Partner
    run: PartnerActionRunner
    onGoToTab: (tab: "capital" | "results") => void
}

/** Pestaña Resumen de la ficha: alertas del backend primero, indicadores, datos del socio y composición del patrimonio. */
export function PartnerSummaryPanel({ partner, run, onGoToTab }: PartnerSummaryPanelProps) {
    const { data: overview, isLoading, isError, refetch } = usePartnerOverview(partner.id)
    const openEntity = useOptionalGlobalModalActions()?.openEntity

    if (isError) {
        return (
            <EmptyState
                icon={AlertTriangle}
                context="generic"
                title="No pudimos cargar el resumen"
                description="Revisa tu conexión e intenta nuevamente."
                variant="compact"
                action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>}
            />
        )
    }

    return (
        <SkeletonShell isLoading={isLoading || !overview} ariaLabel="Cargando resumen del socio">
            {overview && (
                <div className="space-y-8">
                    {overview.alerts.length > 0 && (
                        <section aria-label="Alertas" className="space-y-2">
                            {overview.alerts.map(alert => (
                                <Alert key={alert.code} variant={alert.severity === "warning" ? "warning" : "info"} className="items-center py-3">
                                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium leading-snug">{ALERT_TITLE[alert.code]} · <span className="tabular-nums">{money(alert.amount)}</span></p>
                                            <p className="text-xs leading-snug text-muted-foreground">{ALERT_HINT[alert.code]}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Button type="button" size="sm" variant="outline" onClick={() => run(requestFor(alert, partner.id))}>
                                                {ALERT_BUTTON[alert.action]}
                                            </Button>
                                            <Button type="button" size="sm" variant="ghost" aria-label={`Ver ${ALERT_TITLE[alert.code]}`} onClick={() => onGoToTab(alert.target_tab)}>
                                                Ver
                                            </Button>
                                        </div>
                                    </div>
                                </Alert>
                            ))}
                        </section>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard variant="default" accent="muted" label="Participación" value={`${Number(overview.kpis.equity_percentage).toFixed(2)}%`} subtext="sobre capital enterado" />
                        <StatCard variant="default" accent="muted" label="Capital suscrito" value={money(overview.kpis.total_contributions)} />
                        <StatCard variant="default" accent="muted" label="Capital enterado" value={money(overview.kpis.total_paid_in)} />
                        <StatCard variant="default" accent="muted" label="Patrimonio neto" value={money(overview.kpis.net_equity)} />
                    </div>

                    <section aria-label="Datos del socio" className="space-y-4">
                        <FormSection title="Datos del socio" icon={Info} />
                        <DocumentFieldGrid className="w-auto justify-start text-left" fields={partnerFields(partner, overview.info, openEntity)} />
                    </section>

                    <section aria-label="Composición del patrimonio" className="space-y-4">
                        <FormSection title="Composición del patrimonio" icon={PieChartIcon} />
                        <CompositionBreakdown composition={overview.composition} netEquity={overview.kpis.net_equity} />
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}

const COMPOSITION_ROWS = [
    { key: "capital", label: "Capital enterado", color: "var(--color-primary)" },
    { key: "earnings_balance", label: "Utilidades retenidas", color: "var(--color-success)" },
    { key: "dividends_payable", label: "Dividendos por pagar", color: "var(--color-warning)" },
    { key: "provisional_withdrawals", label: "Retiros provisorios", color: "var(--color-destructive)" },
] as const

/** Dona con lo que suma al patrimonio (los retiros provisorios restan y se listan aparte) y detalle con leyenda. */
function CompositionBreakdown({ composition, netEquity }: { composition: PartnerOverview["composition"]; netEquity: string }) {
    const slices = COMPOSITION_ROWS
        .filter(r => r.key !== "provisional_withdrawals" && Number(composition[r.key]) > 0)
        .map(r => ({ id: r.label, value: Number(composition[r.key]), color: r.color }))
    return (
        <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <div className="h-48">
                <PieChart
                    data={slices}
                    tooltipFormat="currency"
                    innerRadius={0.68}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    centerLabel={{ value: money(netEquity), label: "Patrimonio neto" }}
                    ariaLabel="Composición del patrimonio neto del socio"
                />
            </div>
            <ul className="space-y-2">
                {COMPOSITION_ROWS.map(r => (
                    <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
                            {r.label}
                        </span>
                        <span className="tabular-nums">{r.key === "provisional_withdrawals" ? "− " : ""}{money(composition[r.key])}</span>
                    </li>
                ))}
                <li className="flex items-center justify-between gap-3 border-t pt-2 text-sm font-semibold">
                    <span>Patrimonio neto</span>
                    <span className="tabular-nums">{money(netEquity)}</span>
                </li>
            </ul>
        </div>
    )
}

function partnerFields(
    partner: Partner,
    info: { partner_since: string | null; tax_id: string; contact_id: number },
    openEntity: ((label: string, id: number) => void) | undefined,
): DocumentField[] {
    return [
        {
            label: "Contacto",
            value: openEntity
                ? <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => openEntity("contacts.contact", info.contact_id)}>{partner.name}</Button>
                : partner.name,
        },
        { label: "Socio desde", value: info.partner_since ? <span className="tabular-nums">{formatPlainDate(info.partner_since)}</span> : null },
        { label: "RUT", value: info.tax_id || partner.tax_id },
    ]
}
