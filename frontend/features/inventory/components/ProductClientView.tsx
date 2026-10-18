"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, AnalyticsPanelContent, type AnalyticsPanelConfig, type BulkAction } from '@/components/shared'
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { toPage } from '@/lib/pagination'
import { ProductDrawer } from "./ProductDrawer"
import type { ProductInitialData } from "@/types/forms"
import { Plus, AlertTriangle, BarChart3, Boxes, Package, Store, ShoppingCart, ShoppingBag, Warehouse } from "lucide-react"
import { toast } from "sonner"
import { Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"
import { StockReport } from "./StockReport"
import { ProductInsightsPanel } from "./ProductInsightsPanel"
import type { StockReportItem } from "@/features/inventory/stockReportFields"

import { productEntity, productViews } from "../entity-view/product.entity"
import { DEFAULT_PRODUCT_LIST_QUERY, useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { useProductAnalytics } from "@/features/inventory/hooks/useProductAnalytics"
import { formatQuantity } from "@/lib/money"
import { type Product, type Restriction, type ProductFilters } from "@/features/inventory/types"
import { productActions, type ProductActionsCtx } from "@/features/inventory/productActions"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { productUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { UnifiedSearchConfig } from '@/types/unified-search'

interface ProductClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
    /** Server-rendered first page of the default query (page 1, no filters, server order). */
    initialPage?: InitialProductPage
}

/** DRF envelope of the server-rendered first page (pagination-contract §1.1). */
export interface InitialProductPage {
    results: Product[]
    count: number
    next: string | null
    previous: string | null
}

const DEFAULT_PAGE: { pageIndex: number; pageSize: number } = { pageIndex: 0, pageSize: DEFAULT_PRODUCT_LIST_QUERY.page_size }

export function ProductClientView({ externalOpen, onExternalOpenChange, createAction, initialPage }: ProductClientViewProps) {
    const { categories: categoryOptions } = useCategories()
    const config: UnifiedSearchConfig = useMemo(() => ({
        ...productUnifiedSearchDef,
        filters: [
            ...(productUnifiedSearchDef.filters ?? []),
            {
                type: 'single',
                key: 'category',
                label: 'Categoría',
                serverParam: 'category',
                options: (categoryOptions ?? []).map(c => ({ label: c.name, value: String(c.id) })),
            },
        ],
    }), [categoryOptions])

    const search = useUnifiedSearch(config)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const filters = useMemo<ProductFilters>(() => {
        const raw = { ...search.filters } as Record<string, string>

        // Parse availability multi-select into can_be_sold / can_be_purchased
        const availability = raw['availability']
        if (availability) {
            const values = availability.split(',').filter(Boolean)
            if (values.includes('sale')) raw.can_be_sold = 'true'
            if (values.includes('purchase')) raw.can_be_purchased = 'true'
        } else {
            delete raw.can_be_sold
            delete raw.can_be_purchased
        }
        delete raw['availability']
        delete raw['group_by']

        return {
            parent_template__isnull: true,
            ...raw as Partial<ProductFilters>,
        }
    }, [search.filters])

    // Search group keys → entity field ids (grouping uses the same formatted text as the cell).
    const groupBy = search.groupBy === "product_type" ? "type" : search.groupBy === "category_name" ? "category" : null
    const isGrouping = groupBy !== null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof productEntity.fields>> | null>(null)
    // A new filter, sort or grouping starts again at the first page.
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    // Server order by default (no sort): the header only claims an order the server applied.
    const { view, onViewChange } = useCollectionViewMode("inventory.product")
    const viewParam = searchParams.get('view')
    const isTabParam = !!viewParam && ['resumen', 'ventas', 'compras', 'existencias'].includes(viewParam)
    const initialAnalyticsTab = isTabParam && viewParam ? viewParam : 'resumen'
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState(initialAnalyticsTab)
    const [selectedStockProduct, setSelectedStockProduct] = useState<StockReportItem | null>(null)

    const analyticsFilters = {
        search: filters.search,
        category: filters.category,
        product_type: filters.product_type,
        can_be_sold: filters.can_be_sold,
        can_be_purchased: filters.can_be_purchased,
        is_active: filters.is_active,
    }
    const resumenData = useProductAnalytics(analyticsFilters)
    const ventasData = useProductAnalytics({ ...analyticsFilters, can_be_sold: true, price_field: "sale" })
    const comprasData = useProductAnalytics({ ...analyticsFilters, can_be_purchased: true, price_field: "cost" })

    // Grouping loads one bounded page (GROUP_ROW_LIMIT); the collection warns when it is truncated.
    const { page, products, isLoading, isRefetching, isError, refetch, updateProduct } = useProducts({
        filters: { ...filters, ordering: orderingParam(productEntity, sort) },
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? GROUP_ROW_LIMIT : pageState.pageSize,
        // Only reused by the hook while the query is still the default one it was rendered for.
        initial: initialPage
            ? { page: toPage<Product>(initialPage, 1, DEFAULT_PRODUCT_LIST_QUERY.page_size), params: DEFAULT_PRODUCT_LIST_QUERY }
            : undefined,
    })


    // Restrictions state
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [targetProductName, setTargetProductName] = useState("")
    const [isRetrying, setIsRetrying] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<Product | null>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

    const { entity: selectedFromUrl, clearSelection: clearUrlSelection } = useSelectedEntity<Product>({
        endpoint: '/inventory/products'
    })
    const { openSelected } = useEntityRouteActions()

    const isCreateOpen = searchParams.get("modal") === "new" || externalOpen
    const isEditOpen = !!selectedFromUrl
    const drawerOpen = Boolean(isCreateOpen || isEditOpen)

    const handleCloseModal = (open: boolean = false) => {
        if (!open) {
            onExternalOpenChange?.(false)
            if (isEditOpen) clearUrlSelection()
            if (isCreateOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                params.delete("action")
                params.delete("id")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }
        }
    }

    const handleArchive = async (product: Product, isConfirmed = false) => {
        const isArchiving = product.is_active
        const action = isArchiving ? "archivar" : "restaurar"

        if (!isConfirmed) {
            setCurrentArchivingProduct(product)
            setIsConfirmModalOpen(true)
            return
        }

        // If it's a retry from restrictions dialog, we already have currentArchivingProduct
        const targetProduct = product || currentArchivingProduct
        if (!targetProduct) return

        if (currentArchivingProduct?.id === targetProduct.id && isRestrictionsDialogOpen) {
            setIsRetrying(true)
        }

        try {
            await updateProduct({ id: targetProduct.id, payload: { is_active: !targetProduct.is_active } })
            toast.success(`Producto ${isArchiving ? 'archivado' : 'restaurar'} correctamente.`, {
                description: targetProduct.product_type === 'SUBSCRIPTION'
                    ? `Las suscripciones asociadas han sido ${isArchiving ? 'ocultas' : 'restauradas en la lista'}.`
                    : undefined
            })
            setIsRestrictionsDialogOpen(false)
            setIsConfirmModalOpen(false)
        } catch (error: unknown) {
            const err = error as { response?: { status?: number, data?: { restrictions: Restriction[] } } };
            if (err.response?.status === 400 && err.response?.data?.restrictions) {
                setTargetProductName(targetProduct.name)
                setRestrictions(err.response.data.restrictions)
                setIsRestrictionsDialogOpen(true)
                setIsConfirmModalOpen(false) // Close the confirmation modal if we show restrictions instead
                if (isConfirmed && isRestrictionsDialogOpen) toast.error("Aún existen dependencias por resolver.")
            } else {
                toast.error(`Error al ${action} el producto.`)
            }
        } finally {
            setIsRetrying(false)
        }
    }



    const actionsCtx: ProductActionsCtx = {
        onEdit: (id) => openSelected(id),
        onArchive: (product) => handleArchive(product),
    }

    const bulkActions = useMemo<BulkAction<Product>[]>(() => [
        {
            key: "restore",
            label: "Restaurar",
            icon: Plus,
            intent: "success",
            disabled: (items) => items.length === 0 || !items.every(p => !p.is_active),
            onClick: async (items) => {
                try {
                    await Promise.all(items.map(p => updateProduct({ id: p.id, payload: { is_active: true } })))
                    toast.success(`${items.length} productos restaurados correctamente.`)
                    refetch()
                } catch {
                    toast.error("Error al restaurar los productos.")
                }
            },
        },
        {
            key: "archive",
            label: "Archivar",
            icon: ArchiveIcon,
            intent: "destructive",
            disabled: (items) => items.length === 0 || !items.every(p => p.is_active),
            onClick: async (items) => {
                try {
                    await Promise.all(items.map(p => updateProduct({ id: p.id, payload: { is_active: false } })))
                    toast.success(`${items.length} productos archivados correctamente.`)
                    refetch()
                } catch (error) {
                    showApiError(error, "Error al archivar los productos.")
                }
            },
        },
    ], [updateProduct, refetch])

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => ({
        screen: {
            entityName: "Inventario de Productos",
            activeTab: analyticsActiveTab,
            onTabChange: setAnalyticsActiveTab,
            tabs: [
                {
                    value: "resumen",
                    label: "Resumen",
                    icon: BarChart3,
                    gridRows: "max-content 1fr",
                    columns: [
                        {
                            id: "col-resumen-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-total-products",
                                    colSpan: 1,
                                    fillRemaining: false,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Total Productos",
                                            value: formatQuantity(resumenData.summary.totalProducts),
                                            icon: Package,
                                            accent: "primary",
                                            valueSize: "xl",
                                            loading: resumenData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "type-distribution",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución por Tipo",
                                            variant: "chart",
                                            loading: resumenData.analyticsLoading,
                                            subtext: "Proporción del catálogo por tipo de producto",
                                            chart: { type: "pie-chart", preset: "card", data: resumenData.typePie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-resumen-2",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-with-stock",
                                    colSpan: 1,
                                    fillRemaining: false,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Con Stock",
                                            value: formatQuantity(resumenData.summary.withStock),
                                            icon: Boxes,
                                            accent: "success",
                                            valueSize: "xl",
                                            loading: resumenData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "availability-distribution",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Disponibilidad",
                                            variant: "chart",
                                            loading: resumenData.analyticsLoading,
                                            subtext: "Productos para ventas vs compras",
                                            chart: { type: "pie-chart", preset: "card", data: resumenData.availabilityPie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-resumen-3",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-out-of-stock",
                                    colSpan: 1,
                                    fillRemaining: false,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Agotados",
                                            value: formatQuantity(resumenData.summary.outOfStock),
                                            icon: Store,
                                            accent: "warning",
                                            valueSize: "xl",
                                            loading: resumenData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "category-distribution",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución por Categoría",
                                            variant: "chart",
                                            loading: resumenData.analyticsLoading,
                                            subtext: "Productos por categoría",
                                            chart: { type: "pie-chart", preset: "card", data: resumenData.categoryPie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "ventas",
                    label: "Ventas",
                    icon: ShoppingCart,
                    gridRows: "max-content 1fr",
                    columns: [
                        {
                            id: "col-ventas-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-sellable",
                                    colSpan: 2,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Disponibles para Venta",
                                            value: formatQuantity(ventasData.summary.totalProducts),
                                            icon: ShoppingCart,
                                            accent: "primary",
                                            valueSize: "xl",
                                            loading: ventasData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "ventas-type-distribution",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución por Tipo",
                                            variant: "chart",
                                            loading: ventasData.analyticsLoading,
                                            subtext: "Tipos de producto vendibles",
                                            chart: { type: "pie-chart", preset: "card", data: ventasData.typePie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-ventas-2",
                            weight: 1,
                            sections: [
                                {
                                    id: "ventas-price-range",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Rango de Precio de Venta",
                                            variant: "chart",
                                            loading: ventasData.analyticsLoading,
                                            subtext: "Productos vendibles por rango de precio de lista",
                                            chart: { type: "bar-chart", preset: "card", data: ventasData.priceRangeBar, keys: ["productos"], indexBy: "rango", axisBottomLegend: "Rango", axisLeftLegend: "Productos" },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "compras",
                    label: "Compras",
                    icon: ShoppingBag,
                    gridRows: "max-content 1fr",
                    columns: [
                        {
                            id: "col-compras-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-purchasable",
                                    colSpan: 2,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Disponibles para Compra",
                                            value: formatQuantity(comprasData.summary.totalProducts),
                                            icon: ShoppingBag,
                                            accent: "primary",
                                            valueSize: "xl",
                                            loading: comprasData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "compras-type-distribution",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución por Tipo",
                                            variant: "chart",
                                            loading: comprasData.analyticsLoading,
                                            subtext: "Tipos de producto comprables",
                                            chart: { type: "pie-chart", preset: "card", data: comprasData.typePie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-compras-2",
                            weight: 1,
                            sections: [
                                {
                                    id: "compras-price-range",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Rango de Precio de Compra",
                                            variant: "chart",
                                            loading: comprasData.analyticsLoading,
                                            subtext: "Productos comprables por rango de costo ponderado",
                                            chart: { type: "bar-chart", preset: "card", data: comprasData.priceRangeBar, keys: ["productos"], indexBy: "rango", axisBottomLegend: "Rango", axisLeftLegend: "Productos" },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "existencias",
                    label: "Existencias",
                    icon: Warehouse,
                    gridRows: "1fr",
                    columns: [
                        {
                            id: "col-existencias-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "stock-report-embedded",
                                    colSpan: 1,
                                    fillRemaining: true,
                                    content: {
                                        type: "custom",
                                        render: (
                                            <StockReport
                                                externalFilters={{
                                                    search: filters.search,
                                                    category: filters.category !== undefined ? String(filters.category) : undefined,
                                                    product_type: filters.product_type,
                                                    is_active: filters.is_active !== undefined ? String(filters.is_active) : undefined,
                                                }}
                                                onSelectProduct={setSelectedStockProduct}
                                                selectedProduct={selectedStockProduct}
                                            />
                                        ),
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }), [analyticsActiveTab, resumenData, ventasData, comprasData, filters, selectedStockProduct])

    const collection = useEntityCollection(
        productEntity,
        { rows: products, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: isGrouping ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: { mode: "server", state: sort, onChange: setSort },
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="bulk"
                // ?view=resumen|ventas|… (analytics tab links) opens the analytics view on that tab.
                view={isTabParam ? "analytics" : view}
                onViewChange={onViewChange}
                onOpen={(product) => openSelected(product.id)}
                actions={productActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <UnifiedSearchBar
                                config={config}
                                {...bindUnifiedSearch(search)}
                                placeholder="Buscar producto..."
                            />
                        </div>
                        {createAction}
                    </div>
                </Collection.Toolbar>
                <Collection.View
                    table={productViews.table}
                    card={productViews.card}
                    emptyTitle="Aún no hay productos"
                    emptyDescription="Crea tu primer producto para empezar a construir el catálogo."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    {selectedStockProduct ? (
                        <ProductInsightsPanel
                            productId={selectedStockProduct.id as number}
                            productName={selectedStockProduct.name ?? null}
                            onBack={() => setSelectedStockProduct(null)}
                            onProductChange={(id, name) => setSelectedStockProduct({ ...selectedStockProduct, id, name })}
                        />
                    ) : analyticsPanel.screen ? (
                        <AnalyticsPanelContent
                            entityName={analyticsPanel.screen.entityName}
                            tabs={analyticsPanel.screen.tabs}
                            activeTab={analyticsPanel.screen.activeTab}
                            onTabChange={analyticsPanel.screen.onTabChange}
                        />
                    ) : null}
                </Collection.Analytics>
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            <ProductDrawer
                open={drawerOpen}
                onOpenChange={handleCloseModal}
                initialData={(selectedFromUrl || undefined) as ProductInitialData | undefined}
                onSuccess={refetch}
            />

            <ArchivingRestrictionsModal
                open={isRestrictionsDialogOpen}
                onOpenChange={setIsRestrictionsDialogOpen}
                productName={targetProductName}
                restrictions={restrictions}
                onRetry={currentArchivingProduct ? () => handleArchive(currentArchivingProduct, true) : undefined}
                isRetrying={isRetrying}
            />

            <ActionConfirmModal
                open={isConfirmModalOpen}
                onOpenChange={setIsConfirmModalOpen}
                title={currentArchivingProduct?.is_active ? "Archivar Producto" : "Restaurar Producto"}
                variant={currentArchivingProduct?.is_active ? "warning" : "default"}
                onConfirm={() => { if (currentArchivingProduct) return handleArchive(currentArchivingProduct, true) }}
                confirmText={currentArchivingProduct?.is_active ? "Archivar" : "Restaurar"}
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea {currentArchivingProduct?.is_active ? "archivar" : "restaurar"} el producto{" "}
                            <strong>{currentArchivingProduct?.name}</strong>?
                        </p>

                        {currentArchivingProduct?.is_active && currentArchivingProduct?.product_type === 'SUBSCRIPTION' && (
                            <div className="bg-warning/10 border border-warning/10 p-3 rounded-md flex gap-3 text-warning">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div className="text-xs">
                                    <p className="font-bold mb-1">Impacto en Suscripciones</p>
                                    <p>Al archivar este producto, sus suscripciones activas/pausadas se ocultarán del gestor hasta que el producto sea restaurado.</p>
                                </div>
                            </div>
                        )}

                        {!currentArchivingProduct?.is_active && currentArchivingProduct?.product_type === 'SUBSCRIPTION' && (
                            <p className="text-xs bg-primary/10 text-primary p-2 rounded-md">
                                Al restaurar el producto, sus suscripciones volverán a aparecer en el gestor central.
                            </p>
                        )}
                    </div>
                }
            />
        </div >
    )
}
