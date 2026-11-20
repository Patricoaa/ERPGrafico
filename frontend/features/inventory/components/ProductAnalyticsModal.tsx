"use client"

import { useState, useMemo } from "react"
import { BaseModal, DrawerLayout, RailNav, SkeletonShell } from '@/components/shared'
import {
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    LayoutDashboard,
    Banknote,
    CircleDollarSign,
    Truck,
    Users,
    Building2,
    Percent,
    Hammer,
    Scale,
    Gauge,
} from "lucide-react"
import { useProductCapabilities } from "../hooks/useProducts"
import { ProductSelector } from "@/components/selectors"
import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { WorkOrderWizard } from "@/features/production"
import { DEFAULT_PERIOD } from "../analytics/period"
import { SalesImpactBlock } from "../analytics/SalesImpactBlock"
import { ProductionPerformanceBlock } from "../analytics/ProductionPerformanceBlock"
import { SourcingBlock } from "../analytics/SourcingBlock"
import { OperationsBlock } from "../analytics/OperationsBlock"
import { LegacyInsightsPanel } from "../analytics/LegacyInsightsPanel"
import { isLegacyTab } from "../analytics/legacyTabs"
import { SEGMENT_LABELS, visibleTabIds } from "../analytics/productAnalyticsRegistry"

interface ProductAnalyticsModalProps {
    productId: number | null
    productName?: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onProductChange?: (productId: number, productName: string) => void
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
    { value: "overview",    label: "Resumen",    icon: LayoutDashboard },
    { value: "sales",       label: "Ventas",     icon: TrendingUp },
    { value: "pricing",     label: "Precio y margen", icon: Percent },
    { value: "purchases",   label: "Compras",    icon: Truck },
    { value: "price",       label: "Precio",     icon: CircleDollarSign },
    { value: "cost",        label: "Costos",     icon: Banknote },
    { value: "kardex",      label: "Mov. Stock", icon: ArrowRightLeft },
    { value: "production",  label: "Producción", icon: Factory },
    { value: "manufacturing", label: "Fabricación", icon: Hammer },
    { value: "sourcing", label: "Abastecimiento", icon: Scale },
    { value: "operations", label: "Operación", icon: Gauge },
    { value: "customers",   label: "Clientes",   icon: Users },
    { value: "suppliers",   label: "Proveedores", icon: Building2 },
] as const

type TabValue = typeof TABS[number]["value"]

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
    const period = DEFAULT_PERIOD

    const [requestedTab, setActiveTab] = useState<TabValue>("overview")
    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    const visibleTabs = useMemo(() => {
        const ids = new Set<string>(capabilities ? visibleTabIds(capabilities) : [])
        return TABS.filter(t => ids.has(t.value))
    }, [capabilities])
    // A tab that stops applying (e.g. after switching product) falls back to the overview.
    const activeTab: TabValue = visibleTabs.some(t => t.value === requestedTab) ? requestedTab : "overview"

    const openTransaction = (id: number | string, type: string) => setSelectedTransaction({ id, type: type as TransactionType })
    const closeTransaction = () => setSelectedTransaction(null)
    const openWorkOrder = (id: number) => setActiveWorkOrderId(id)
    const closeWorkOrder = () => setActiveWorkOrderId(null)

    const segmentLabel = capabilities ? SEGMENT_LABELS[capabilities.segment] : null
    const productIdentity = onProductChange ? (
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
    const productSelectorSlot = productIdentity || segmentLabel ? (
        <div className="flex flex-col gap-1.5">
            {productIdentity}
            {segmentLabel && <span className="text-xs text-muted-foreground">{segmentLabel}</span>}
        </div>
    ) : null

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            {selectedTransaction && (
                <LazyDrawer
                    type={selectedTransaction.type}
                    id={Number(selectedTransaction.id)}
                    open={!!selectedTransaction}
                    onOpenChange={(open) => { if (!open) closeTransaction() }}
                />
            )}
            {activeWorkOrderId !== null && (
                <WorkOrderWizard
                    mode={{ kind: 'manage', orderId: activeWorkOrderId }}
                    open={!!activeWorkOrderId}
                    onOpenChange={(open) => !open && closeWorkOrder()}
                />
            )}

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
                            />
                        }
                        leftRailWidth="w-14 sm:w-56"
                        noPadding
                        contentClassName="p-4"
                    >
                        {/* Compact copy of the rail's top slot (hidden there below sm) */}
                        {productSelectorSlot && <div className="mb-3 shrink-0 sm:hidden">{productSelectorSlot}</div>}
                        {/* ── Tab content ── */}
                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1 pb-4 min-h-0">
                            {isLegacyTab(activeTab) && (
                                <LegacyInsightsPanel
                                    productId={productId}
                                    tab={activeTab}
                                    capabilities={capabilities}
                                    onOpenTransaction={openTransaction}
                                    onOpenWorkOrder={openWorkOrder}
                                />
                            )}
                            {activeTab === "pricing" && <SalesImpactBlock productId={productId} period={period} />}
                            {activeTab === "manufacturing" && <ProductionPerformanceBlock productId={productId} period={period} />}
                            {activeTab === "sourcing" && <SourcingBlock productId={productId} period={period} />}
                            {activeTab === "operations" && <OperationsBlock productId={productId} period={period} />}
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
                    <ProductAnalyticsPanelInner
                        productId={productId}
                        productName={productName}
                        onProductChange={onProductChange}
                    />
                )}
            </div>
        </BaseModal>
    )
}

// Compatibilidad temporal con importaciones existentes
export const ProductInsightsDrawer = ProductAnalyticsModal
