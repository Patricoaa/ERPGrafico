"use client"

import { AlertTriangle, Info, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Banner, EmptyState, SkeletonShell, Section } from "@/components/shared"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import type { Partner, PartnerAlertCode } from "@/features/contacts"
import { usePartnerOverview } from "../hooks"
import { PartnerParticipationPanel } from "./PartnerParticipationPanel"
import { PartnerParticipationHistory } from "./PartnerParticipationHistory"

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

/** Pestaña Resumen: alertas que llevan a Capital, datos del socio junto a su participación y su evolución anual. */
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
                                <Banner
                                    key={alert.code}
                                    tone={alert.severity === "warning" ? "warning" : "info"}
                                    bleed="lg"
                                    title={ALERT_TITLE[alert.code]}
                                    value={money(alert.amount)}
                                    actions={
                                        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onGoToTab(alert.target_tab)}>
                                            Ver en Capital
                                        </Button>
                                    }
                                >
                                    {ALERT_HINT[alert.code]}
                                </Banner>
                            ))}
                        </section>
                    )}

                    <section aria-label="Datos del socio" className="space-y-4">
                        <Section.Header spaced title="Datos del socio" icon={Info} />
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] lg:gap-10">
                            <Section className="min-w-0">
                                <Section.Row
                                    variant="stat"
                                    plain
                                    title="Contacto"
                                    value={openEntity
                                        ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-0 text-sm font-normal text-foreground underline-offset-4 hover:bg-transparent hover:underline"
                                                onClick={() => openEntity("contacts.contact", overview.info.contact_id)}
                                            >
                                                {partner.name}
                                            </Button>
                                        )
                                        : partner.name}
                                />
                                <Section.Row
                                    variant="stat"
                                    plain
                                    title="Socio desde"
                                    value={overview.info.partner_since ? <span className="tabular-nums">{formatPlainDate(overview.info.partner_since)}</span> : "—"}
                                />
                                <Section.Row variant="stat" plain title="RUT" value={overview.info.tax_id || partner.tax_id || "—"} />
                            </Section>
                            <section aria-label="Distribución de capital" className="min-w-0">
                                <PartnerParticipationPanel partner={partner} />
                            </section>
                        </div>
                    </section>

                    <section aria-label="Participación histórica" className="min-w-0 space-y-4">
                        <Section.Header spaced title="Participación histórica" icon={History} />
                        <PartnerParticipationHistory partnerId={partner.id} />
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}
