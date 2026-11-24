import { formatMoney } from "@/lib/money"
import { composeCosts } from "./composeCosts"
import { composePricing } from "./composePricing"
import { composeProcurement } from "./composeProcurement"
import { composeProduction } from "./composeProduction"
import { composeSales } from "./composeSales"
import { composeStock } from "./composeStock"
import { composeSubscription } from "./composeSubscription"
import type { ProductCosts } from "./costs.types"
import type { ProductPricing } from "./pricing.types"
import type { ProductProcurement } from "./procurement.types"
import { TAB_ORDER, type ProductAnalyticsTabId } from "./productAnalyticsRegistry"
import type { ProductProductionAnalysis } from "./productionAnalysis.types"
import type { ProductSales } from "./sales.types"
import type { ProductStockAnalysis } from "./stockAnalysis.types"
import type { ProductSubscriptionAnalysis } from "./subscriptionAnalysis.types"

export interface OverviewSources {
    sales?: ProductSales | null
    pricing?: ProductPricing | null
    costs?: ProductCosts | null
    procurement?: ProductProcurement | null
    inventory?: ProductStockAnalysis | null
    production?: ProductProductionAnalysis | null
    subscription?: ProductSubscriptionAnalysis | null
}

export type OverviewValueKind = "money" | "number" | "percent" | "days"

export interface OverviewCard {
    tab: ProductAnalyticsTabId
    label: string
    value: number | null
    kind: OverviewValueKind
    unit?: string
    context?: string
    delta?: { current: number; previous: number; inverse?: boolean }
}

export interface OverviewFindingGroup {
    tab: ProductAnalyticsTabId
    findings: Array<{ id: string; message: string }>
}

type SourceTab = keyof OverviewSources
type Built = { card: Omit<OverviewCard, "tab">; findings: Array<{ id: string; message: string }> }

const round2 = (value: number) => Number(value.toFixed(2))

function build(tab: SourceTab, sources: OverviewSources, capabilities: { has_variants: boolean }): Built | null {
    switch (tab) {
        case "sales": {
            const d = sources.sales
            if (!d) return null
            const previous = d.kpis.previous
            return {
                card: {
                    label: "Unidades vendidas", value: d.kpis.units, kind: "number", unit: "un",
                    context: `Ingreso neto ${formatMoney(d.kpis.net_revenue)}`,
                    delta: previous && previous.units > 0 ? { current: d.kpis.units, previous: previous.units } : undefined,
                },
                findings: composeSales(d).findings,
            }
        }
        case "pricing": {
            const d = sources.pricing
            if (!d) return null
            const card: Built["card"] = d.has_cost
                ? { label: "Margen realizado", value: d.kpis.margin_pct, kind: "percent" }
                : { label: "Precio realizado", value: d.kpis.avg_price, kind: "money" }
            return { card, findings: composePricing(d, capabilities).findings }
        }
        case "costs": {
            const d = sources.costs
            if (!d) return null
            const composition = composeCosts(d)
            const change = d.kpis.cost_change_pct
            return {
                card: {
                    label: composition.hero.label, value: composition.hero.value, kind: "money",
                    context: change === null ? undefined : `${change >= 0 ? "+" : ""}${change.toFixed(1)} % en el periodo`,
                },
                findings: composition.findings,
            }
        }
        case "procurement": {
            const d = sources.procurement
            if (!d) return null
            const card: Built["card"] = d.coverage
                ? {
                    label: "Cobertura", value: d.coverage.coverage_days === null ? null : Math.round(d.coverage.coverage_days),
                    kind: "days", unit: "días", context: `${round2(d.kpis.units)} un compradas en el periodo`,
                }
                : { label: "Gasto del periodo", value: d.kpis.spend, kind: "money", context: `${round2(d.kpis.units)} un compradas` }
            return { card, findings: composeProcurement(d).findings }
        }
        case "inventory": {
            const d = sources.inventory
            if (!d) return null
            return {
                card: {
                    label: "Existencia", value: round2(d.today.on_hand), kind: "number", unit: "un",
                    context: `Disponible: ${round2(d.today.available)} un`,
                },
                findings: composeStock(d).findings,
            }
        }
        case "production": {
            const d = sources.production
            if (!d) return null
            const card: Built["card"] | null = d.made
                ? {
                    label: "Unidades producidas", value: round2(d.made.kpis.units), kind: "number", unit: "un",
                    context: `${d.made.kpis.orders} órdenes terminadas`,
                    delta: d.made.kpis.previous && d.made.kpis.previous.units > 0
                        ? { current: d.made.kpis.units, previous: d.made.kpis.previous.units } : undefined,
                }
                : d.input
                    ? { label: "Consumo en OT", value: round2(d.input.kpis.consumed), kind: "number", unit: "un", context: `${d.input.kpis.orders} OT` }
                    : null
            return card ? { card, findings: composeProduction(d).findings } : null
        }
        case "subscription": {
            const d = sources.subscription
            if (!d) return null
            return {
                card: { label: "Costo anualizado", value: d.today.annualized_total, kind: "money", context: `${d.today.active_count} activas` },
                findings: composeSubscription(d).findings,
            }
        }
    }
}

const SOURCE_TABS: readonly SourceTab[] = ["sales", "pricing", "costs", "procurement", "inventory", "production", "subscription"]

/** Hero figure and findings of every visible tab, in the rail order. Reuses each tab's compose function. Pure. */
export function composeOverview(
    sources: OverviewSources, capabilities: { has_variants: boolean },
): { cards: OverviewCard[]; groups: OverviewFindingGroup[] } {
    const cards: OverviewCard[] = []
    const groups: OverviewFindingGroup[] = []
    const ordered = TAB_ORDER.filter((tab): tab is SourceTab => (SOURCE_TABS as readonly string[]).includes(tab))
    for (const tab of ordered) {
        const built = build(tab, sources, capabilities)
        if (!built) continue
        cards.push({ tab, ...built.card })
        if (built.findings.length) groups.push({ tab, findings: built.findings.map(({ id, message }) => ({ id, message })) })
    }
    return { cards, groups }
}
