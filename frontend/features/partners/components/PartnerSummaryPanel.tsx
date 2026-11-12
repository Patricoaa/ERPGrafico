"use client"

import { AlertTriangle, Info, PieChart as PieChartIcon, History } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState, FormSection, SkeletonShell, DocumentFieldGrid, type DocumentField } from "@/components/shared"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import type { Partner, PartnerAlertCode } from "@/features/contacts"
import { usePartnerOverview } from "../hooks"
import { PartnerParticipationPanel } from "./PartnerParticipationPanel"
import { PartnerStakesTable } from "./PartnerStakesTable"

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

interface PartnerSummaryPanelProps {
    partner: Partner
    onGoToTab: (tab: "capital") => void
}

/** Pestaña Resumen: alertas que llevan a Capital, datos del socio, su participación y el historial de vigencias. */
export function PartnerSummaryPanel({ partner, onGoToTab }: PartnerSummaryPanelProps) {
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
                                        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onGoToTab(alert.target_tab)}>
                                            Ver en Capital
                                        </Button>
                                    </div>
                                </Alert>
                            ))}
                        </section>
                    )}

                    <section aria-label="Datos del socio" className="space-y-4">
                        <FormSection title="Datos del socio" icon={Info} />
                        <DocumentFieldGrid className="w-auto justify-start text-left" fields={partnerFields(partner, overview.info, openEntity)} />
                    </section>

                    <div className="grid gap-8 lg:grid-cols-2">
                        <section aria-label="Distribución de capital" className="min-w-0 space-y-4">
                            <FormSection title="Distribución de capital" icon={PieChartIcon} />
                            <PartnerParticipationPanel partner={partner} />
                        </section>
                        <section aria-label="Participación histórica" className="min-w-0 space-y-4">
                            <FormSection title="Participación histórica" icon={History} />
                            <PartnerStakesTable partnerId={partner.id} />
                        </section>
                    </div>
                </div>
            )}
        </SkeletonShell>
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
