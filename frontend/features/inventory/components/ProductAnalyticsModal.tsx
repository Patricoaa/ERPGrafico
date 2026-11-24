"use client"

import { useState, useMemo } from "react"
import { BaseModal, DrawerLayout, RailNav, SkeletonShell } from '@/components/shared'
import {
    BarChart3,
    Factory,
    LayoutDashboard,
    Banknote,
    Package,
    Truck,
    Percent,
    Repeat,
    ShoppingCart,
} from "lucide-react"
import { useProductCapabilities } from "../hooks/useProducts"
import { ProductSelector } from "@/components/selectors"
import { DEFAULT_PERIOD, type PeriodKey } from "../analytics/period"
import { PeriodControl } from "../analytics/PeriodControl"
import { TabContent } from "../analytics/TabContent"
import { RailControlsProvider, ViewControlsSlot } from "../analytics/RailControls"
import { TAB_LABELS, visibleTabIds, type ProductAnalyticsTabId } from "../analytics/productAnalyticsRegistry"

interface ProductAnalyticsModalProps {
    productId: number | null
    productName?: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onProductChange?: (productId: number, productName: string) => void
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<ProductAnalyticsTabId, typeof BarChart3> = {
    overview: LayoutDashboard,
    sales: ShoppingCart,
    pricing: Percent,
    costs: Banknote,
    procurement: Truck,
    inventory: Package,
    production: Factory,
    subscription: Repeat,
}

const TABS = (Object.keys(TAB_ICONS) as ProductAnalyticsTabId[]).map((value) => ({
    value, label: TAB_LABELS[value], icon: TAB_ICONS[value],
}))

type TabValue = ProductAnalyticsTabId

// ─── Inner panel (runs inside the open modal) ──────────────────────────────────

function ProductAnalyticsPanelInner({
    productId,
    productName,
    onProductChange,
}: {
    productId: number
    productName?: string | null
    onProductChange?: (productId: number, productName: string) => void
}) {
    const { capabilities, isLoading, isError } = useProductCapabilities(productId)
    const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD)
    const [requestedTab, setActiveTab] = useState<TabValue>("overview")

    const visibleTabs = useMemo(() => {
        const ids = new Set<string>(capabilities ? visibleTabIds(capabilities) : [])
        return TABS.filter(t => ids.has(t.value))
    }, [capabilities])
    // A tab that stops applying (e.g. after switching product) falls back to the overview.
    const activeTab: TabValue = visibleTabs.some(t => t.value === requestedTab) ? requestedTab : "overview"

    const productSelectorSlot = onProductChange ? (
        <ProductSelector
            value={productId}
            onChange={() => {}}
            onSelect={(p) => onProductChange(p.id as number, p.name)}
            placeholder="Buscar producto..."
            variant="inline"
        />
    ) : productName ? (
        <span className="block text-sm font-semibold leading-tight break-words">{productName}</span>
    ) : null
    const periodControl = (
        <>
            <PeriodControl value={period} onChange={setPeriod} />
            <ViewControlsSlot />
        </>
    )

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {isLoading || !capabilities ? (
                    isError ? (
                        <p role="alert" className="p-6 text-sm text-destructive">No se pudo cargar el análisis del producto.</p>
                    ) : (
                        <SkeletonShell isLoading ariaLabel="Cargando insights del producto">
                            <div className="p-6" />
                        </SkeletonShell>
                    )
                ) : (
                    <DrawerLayout
                        leftRail={
                            <RailNav
                                ariaLabel="Secciones de análisis de producto"
                                sections={[{ items: [...visibleTabs] }]}
                                value={activeTab}
                                onValueChange={(v) => setActiveTab(v as TabValue)}
                                top={productSelectorSlot}
                                bottom={periodControl}
                            />
                        }
                        leftRailWidth="w-14 sm:w-56"
                        noPadding
                        contentClassName="p-4"
                    >
                        {/* Compact copy of the rail's top slot (hidden there below sm) */}
                        {productSelectorSlot && <div className="mb-3 shrink-0 sm:hidden">{productSelectorSlot}</div>}
                        <div className="mb-2 shrink-0 sm:hidden">{periodControl}</div>
                        {/* ── Tab content ── */}
                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1 pb-4 min-h-0">
                            <TabContent
                                tab={activeTab}
                                productId={productId}
                                period={period}
                                capabilities={capabilities}
                                onSelectTab={setActiveTab}
                            />
                        </div>
                    </DrawerLayout>
                )}
            </div>
        </div>
    )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ProductAnalyticsModal({
    productId,
    productName,
    open,
    onOpenChange,
    onProductChange,
}: ProductAnalyticsModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            icon={BarChart3}
            title="Análisis de producto"
            size="xl"
            hideScrollArea
            contentClassName="overflow-hidden"
        >
            <div className="h-[80vh] overflow-hidden flex flex-col">
                {productId && (
                    <RailControlsProvider>
                        <ProductAnalyticsPanelInner
                            productId={productId}
                            productName={productName}
                            onProductChange={onProductChange}
                        />
                    </RailControlsProvider>
                )}
            </div>
        </BaseModal>
    )
}

// Compatibilidad temporal con importaciones existentes
export const ProductInsightsDrawer = ProductAnalyticsModal
