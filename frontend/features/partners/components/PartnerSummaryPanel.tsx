"use client"

import { AlertTriangle, Info, PieChart } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState, FormSection, SkeletonShell, StatCard, DocumentFieldGrid, type DocumentField } from "@/components/shared"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import type { Partner, PartnerAlertCode, PartnerOverviewAlert } from "@/features/contacts"
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
                                <Alert key={alert.code} variant={alert.severity === "warning" ? "warning" : "info"}>
                                    <AlertTitle>{ALERT_TITLE[alert.code]} · {money(alert.amount)}</AlertTitle>
                                    <AlertDescription className="flex items-center justify-between gap-3">
                                        <span>{ALERT_HINT[alert.code]}</span>
                                        <span className="flex shrink-0 gap-2">
                                            <Button type="button" size="sm" variant="outline" onClick={() => run(requestFor(alert, partner.id))}>
                                                {ALERT_BUTTON[alert.action]}
                                            </Button>
                                            <Button type="button" size="sm" variant="ghost" aria-label={`Ver ${ALERT_TITLE[alert.code]}`} onClick={() => onGoToTab(alert.target_tab)}>
                                                Ver
                                            </Button>
                                        </span>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </section>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard variant="minimal" accent="primary" label="Participación" value={`${Number(overview.kpis.equity_percentage).toFixed(2)}%`} subtext="sobre capital enterado" />
                        <StatCard variant="minimal" accent="muted" label="Capital suscrito" value={money(overview.kpis.total_contributions)} />
                        <StatCard variant="minimal" accent="success" label="Capital enterado" value={money(overview.kpis.total_paid_in)} />
                        <StatCard variant="minimal" accent="primary" label="Patrimonio neto" value={money(overview.kpis.net_equity)} />
                    </div>

                    <section aria-label="Datos del socio" className="space-y-4">
                        <FormSection title="Datos del socio" icon={Info} />
                        <DocumentFieldGrid className="w-auto justify-start text-left" fields={partnerFields(partner, overview.info, openEntity)} />
                    </section>

                    <section aria-label="Composición del patrimonio" className="space-y-4">
                        <FormSection title="Composición del patrimonio" icon={PieChart} />
                        <ul className="space-y-2">
                            <CompositionRow label="Capital" value={overview.composition.capital} />
                            <CompositionRow label="Utilidades retenidas" value={overview.composition.earnings_balance} />
                            <CompositionRow label="Dividendos por pagar" value={overview.composition.dividends_payable} />
                            <CompositionRow label="Retiros provisorios" value={overview.composition.provisional_withdrawals} />
                            <li className="flex items-center justify-between gap-3 border-t pt-2 text-sm font-semibold">
                                <span>Patrimonio neto</span>
                                <span className="tabular-nums">{money(overview.kpis.net_equity)}</span>
                            </li>
                        </ul>
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}

function CompositionRow({ label, value }: { label: string; value: string }) {
    return (
        <li className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{money(value)}</span>
        </li>
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
        { label: "ID fiscal", value: info.tax_id || partner.tax_id },
    ]
}
