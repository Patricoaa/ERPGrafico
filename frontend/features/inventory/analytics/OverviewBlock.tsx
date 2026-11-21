"use client"

import { useMemo } from "react"
import { Metric } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/money"
import { composeOverview, type OverviewCard, type OverviewSources } from "./composeOverview"
import { periodToDateFrom, periodToGranularity, type PeriodKey } from "./period"
import { TAB_LABELS, visibleTabIds, type ProductAnalyticsTabId, type ProductCapabilities } from "./productAnalyticsRegistry"
import { useProductCosts } from "../hooks/useProductCosts"
import { useProductPricing } from "../hooks/useProductPricing"
import { useProductProcurement } from "../hooks/useProductProcurement"
import { useProductProductionAnalysis } from "../hooks/useProductProductionAnalysis"
import { useProductSales } from "../hooks/useProductSales"
import { useProductStockAnalysis } from "../hooks/useProductStockAnalysis"
import { useProductSubscriptionAnalysis } from "../hooks/useProductSubscriptionAnalysis"

interface OverviewBlockProps {
    productId: number
    period: PeriodKey
    capabilities: ProductCapabilities
    onSelectTab: (tab: ProductAnalyticsTabId) => void
}

type SourceTab = keyof OverviewSources
type SourceState = { isLoading: boolean; isError: boolean }

function formatValue(card: OverviewCard): string | number | null {
    if (card.value === null) return null
    if (card.kind === "money") return formatMoney(card.value)
    if (card.kind === "percent") return card.value.toFixed(1)
    return card.value
}

/** "Resumen": the hero figure and the findings of every visible tab, with a shortcut to each tab. */
export function OverviewBlock({ productId, period, capabilities, onSelectTab }: OverviewBlockProps) {
    const visible = useMemo(() => new Set(visibleTabIds(capabilities)), [capabilities])
    const idFor = (tab: SourceTab) => (visible.has(tab) ? productId : null)
    const base = useMemo(
        () => ({ granularity: periodToGranularity(period), date_from: periodToDateFrom(period) }),
        [period],
    )
    const stockParams = useMemo(() => ({ ...base, idle_days: 90 as const }), [base])
    const productionParams = useMemo(() => ({ ...base, increase_pct: 10 as const }), [base])

    const results = {
        sales: useProductSales(idFor("sales"), base),
        pricing: useProductPricing(idFor("pricing"), base),
        costs: useProductCosts(idFor("costs"), base),
        procurement: useProductProcurement(idFor("procurement"), base),
        inventory: useProductStockAnalysis(idFor("inventory"), stockParams),
        production: useProductProductionAnalysis(idFor("production"), productionParams),
        subscription: useProductSubscriptionAnalysis(idFor("subscription"), base),
    }
    const sources: OverviewSources = {
        sales: results.sales.data, pricing: results.pricing.data, costs: results.costs.data,
        procurement: results.procurement.data, inventory: results.inventory.data,
        production: results.production.data, subscription: results.subscription.data,
    }
    const { cards, groups } = composeOverview(sources, capabilities)
    const pending = (Object.keys(results) as SourceTab[]).filter((tab) => visible.has(tab) && !sources[tab])

    const goTo = (tab: ProductAnalyticsTabId) => (
        <Button type="button" variant="link" size="sm" className="h-auto self-start px-0" onClick={() => onSelectTab(tab)}>
            Ver en {TAB_LABELS[tab]}
        </Button>
    )
    const status = (tab: SourceTab): SourceState => results[tab]

    return (
        <div className="@container flex flex-col gap-4">
            <section aria-label="Hallazgos" className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">Hallazgos</h3>
                {groups.length === 0 && <p className="text-sm italic text-muted-foreground">Sin hallazgos en el periodo</p>}
                {groups.map((group) => (
                    <section key={group.tab} aria-label={`Hallazgos de ${TAB_LABELS[group.tab]}`} className="flex flex-col gap-1">
                        <h4 className="text-xs font-medium text-muted-foreground">{TAB_LABELS[group.tab]}</h4>
                        <ul className="flex flex-col gap-2">
                            {group.findings.map((finding) => (
                                <li key={finding.id} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                                    {finding.message}
                                </li>
                            ))}
                        </ul>
                        {goTo(group.tab)}
                    </section>
                ))}
            </section>
            <section aria-label="Cifras por tab" className="grid grid-cols-1 gap-3 @[40rem]:grid-cols-2 @[64rem]:grid-cols-3">
                {cards.map((card) => (
                    <div key={card.tab} className="flex flex-col gap-1">
                        <Metric
                            label={card.label}
                            value={formatValue(card)}
                            unit={card.kind === "percent" ? "%" : card.unit}
                            context={card.context ? `${TAB_LABELS[card.tab]} · ${card.context}` : TAB_LABELS[card.tab]}
                            delta={card.delta}
                        />
                        {goTo(card.tab)}
                    </div>
                ))}
                {pending.map((tab) => {
                    const { isLoading, isError } = status(tab)
                    if (isError) {
                        return (
                            <Metric key={tab} label={TAB_LABELS[tab]} error={{ message: `No se pudo cargar ${TAB_LABELS[tab]}` }} />
                        )
                    }
                    if (!isLoading) return null
                    return (
                        <div key={tab} role="status" aria-label={`Cargando ${TAB_LABELS[tab]}`}>
                            <Metric label={TAB_LABELS[tab]} loading />
                        </div>
                    )
                })}
            </section>
        </div>
    )
}
