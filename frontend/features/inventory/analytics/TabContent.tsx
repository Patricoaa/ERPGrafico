"use client"

import { LegacyInsightsPanel } from "./LegacyInsightsPanel"
import type { LegacyTabId } from "./legacyTabs"
import { OperationsBlock } from "./OperationsBlock"
import type { PeriodKey } from "./period"
import { ProductionPerformanceBlock } from "./ProductionPerformanceBlock"
import type { ProductAnalyticsTabId, ProductCapabilities } from "./productAnalyticsRegistry"
import { PricingBlock } from "./PricingBlock"
import { SourcingBlock } from "./SourcingBlock"

interface TabContentProps {
    tab: ProductAnalyticsTabId
    productId: number
    period: PeriodKey
    capabilities: ProductCapabilities
    onOpenTransaction: (id: number | string, type: string) => void
    onOpenWorkOrder: (id: number) => void
}

/** Tabs que ya no usan contenido del endpoint `insights` (ni el período lo ignora). */
export function tabHasLegacyContent(tab: ProductAnalyticsTabId): boolean {
    return tab !== "subscription" && tab !== "pricing"
}

/**
 * Contenido transitorio de cada tab: apila lo que absorbe de los tabs anteriores. Cada plan por tab
 * reemplaza su entrada por el bloque rediseñado y retira el contenido legado correspondiente.
 */
export function TabContent({
    tab, productId, period, capabilities, onOpenTransaction, onOpenWorkOrder,
}: TabContentProps) {
    const legacy = (legacyTab: LegacyTabId) => (
        <LegacyInsightsPanel
            key={legacyTab}
            productId={productId}
            tab={legacyTab}
            capabilities={capabilities}
            onOpenTransaction={onOpenTransaction}
            onOpenWorkOrder={onOpenWorkOrder}
        />
    )

    switch (tab) {
        case "overview":
            return legacy("overview")
        case "sales":
            return <>{legacy("sales")}{legacy("customers")}</>
        case "pricing":
            return <PricingBlock productId={productId} period={period} capabilities={capabilities} />
        case "costs":
            return (
                <>
                    {legacy("cost")}
                    {capabilities.manufactures && capabilities.buys && (
                        <SourcingBlock productId={productId} period={period} section="make_vs_buy" />
                    )}
                </>
            )
        case "procurement":
            return <>{legacy("purchases")}{legacy("suppliers")}</>
        case "inventory":
            return <>{legacy("kardex")}<OperationsBlock productId={productId} period={period} /></>
        case "production":
            return (
                <>
                    {legacy("production")}
                    {capabilities.manufactures && <ProductionPerformanceBlock productId={productId} period={period} />}
                    {capabilities.used_in_production && (
                        <SourcingBlock productId={productId} period={period} section="used_in" />
                    )}
                </>
            )
        case "subscription":
            return <OperationsBlock productId={productId} period={period} />
    }
}
