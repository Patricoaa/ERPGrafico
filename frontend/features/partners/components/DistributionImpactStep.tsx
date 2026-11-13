"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ModalContentSkeleton, Section } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { distributionPartnerEntity, impactLossViews, impactProfitViews, impactPartnerToRow } from "../entity-view/distributionPartner.entity"
import { useProfitDistributionImpact } from "../hooks"

const num = (v: string | undefined) => Number(v) || 0

/**
 * Paso previo a la ejecución: todo lo que provocará la distribución — reparto por socio,
 * retiros provisorios que se absorben y cambio de participación (%) por reinversión/retención.
 */
export function DistributionImpactStep({ resolutionId }: { resolutionId: number }) {
    const { impact, isLoading, isError, refetch } = useProfitDistributionImpact(resolutionId)
    const rows = useMemo(() => (impact?.partners ?? []).map(impactPartnerToRow), [impact])
    const collection = useEntityCollection(distributionPartnerEntity, { rows }, { pagination: { mode: "none" } })

    if (isLoading) return <ModalContentSkeleton fields={4} />
    if (isError || !impact) {
        return (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                <span>No se pudieron calcular los impactos de la distribución.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
            </div>
        )
    }

    const { totals, partners, is_profit: isProfit } = impact
    const offsetTotal = num(totals.provisional_offset)
    const absorbing = partners.filter(p => num(p.provisional_withdrawals_offset) > 0)
    const changed = partners.filter(p => p.percentage_changes)

    return (
        <div className="space-y-6">
            <Section title="Impactos de la distribución">
                {offsetTotal > 0 && (
                    <Section.Note>
                        <strong className="text-foreground">Absorción de retiros provisorios:</strong>{" "}
                        se descontarán {formatCurrency(offsetTotal)} del bruto de {absorbing.length === 1 ? "1 socio" : `${absorbing.length} socios`} ({absorbing.map(p => p.partner_name).join(", ")}).
                        Solo el neto queda disponible para dividendos, reinversión o retención.
                    </Section.Note>
                )}
                {isProfit && num(totals.reinvest) + num(totals.retained) > 0 && (
                    <Section.Note tone="success">
                        Se capitalizan {formatCurrency(num(totals.reinvest))} por reinversión y se retienen {formatCurrency(num(totals.retained))}: aumenta el patrimonio de los socios beneficiados.
                    </Section.Note>
                )}
                {isProfit && num(totals.dividend) > 0 && (
                    <Section.Note tone="success">Se generan {formatCurrency(num(totals.dividend))} en «Dividendos por Pagar».</Section.Note>
                )}
                {impact.percentages_change ? (
                    <Section.Note>
                        <strong className="text-foreground">Cambian los porcentajes de participación</strong> de {changed.length} de {partners.length} socios al ejecutar:
                        <ul className="mt-1 space-y-0.5">
                            {changed.map(p => {
                                const delta = num(p.percentage_after) - num(p.percentage_before)
                                return (
                                    <li key={p.partner} className="flex justify-between gap-4">
                                        <span>{p.partner_name}</span>
                                        <span className="tabular-nums">
                                            {p.percentage_before}% → {p.percentage_after}% ({delta > 0 ? "+" : ""}{delta.toFixed(2)})
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    </Section.Note>
                ) : (
                    <Section.Note tone="success">Los porcentajes de participación no cambian.</Section.Note>
                )}
            </Section>

            <Collection.Root collection={collection} label="Impactos por socio">
                <Collection.View
                    variant="default"
                    table={(isProfit ? impactProfitViews : impactLossViews).table}
                    emptyTitle="Sin socios"
                    emptyDescription="La distribución no tiene líneas."
                />
            </Collection.Root>
        </div>
    )
}
