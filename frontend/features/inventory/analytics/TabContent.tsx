"use client"

import { CostsBlock } from "./CostsBlock"
import { OverviewBlock } from "./OverviewBlock"
import type { PeriodKey } from "./period"
import { ProductionBlock } from "./ProductionBlock"
import type { ProductAnalyticsTabId, ProductCapabilities } from "./productAnalyticsRegistry"
import { PricingBlock } from "./PricingBlock"
import { ProcurementBlock } from "./ProcurementBlock"
import { SalesBlock } from "./SalesBlock"
import { StockBlock } from "./StockBlock"
import { SubscriptionBlock } from "./SubscriptionBlock"

interface TabContentProps {
    tab: ProductAnalyticsTabId
    productId: number
    period: PeriodKey
    capabilities: ProductCapabilities
    onSelectTab: (tab: ProductAnalyticsTabId) => void
}

/** Contenido de cada tab del análisis de producto: un bloque con su propio endpoint (ADR-0150). */
export function TabContent({ tab, productId, period, capabilities, onSelectTab }: TabContentProps) {
    switch (tab) {
        case "overview":
            return <OverviewBlock productId={productId} period={period} capabilities={capabilities} onSelectTab={onSelectTab} />
        case "sales":
            return <SalesBlock productId={productId} period={period} />
        case "pricing":
            return <PricingBlock productId={productId} period={period} capabilities={capabilities} />
        case "costs":
            return <CostsBlock productId={productId} period={period} />
        case "procurement":
            return <ProcurementBlock productId={productId} period={period} />
        case "inventory":
            return <StockBlock productId={productId} period={period} />
        case "production":
            return <ProductionBlock productId={productId} period={period} />
        case "subscription":
            return <SubscriptionBlock productId={productId} period={period} />
    }
}
