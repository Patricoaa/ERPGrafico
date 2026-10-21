"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, AnalyticsPanelContent, type BulkAction } from '@/components/shared'
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { toPage } from '@/lib/pagination'
import { ProductDrawer } from "./ProductDrawer"
import type { ProductInitialData } from "@/types/forms"
import { Plus, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"
import { ProductInsightsDrawer } from "./ProductInsightsDrawer"
import { StockReport } from "./StockReport"
import { buildProductAnalyticsScreen } from "./productAnalyticsScreen"
import type { StockReportItem } from "@/features/inventory/entity-view/stockReport.entity"

import { productEntity, productViews } from "../entity-view/product.entity"
import { DEFAULT_PRODUCT_LIST_QUERY, useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { useProductAnalytics } from "@/features/inventory/hooks/useProductAnalytics"
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

/** Search group keys → entity field ids (grouping uses the same formatted text as the cell). */
const PRODUCT_GROUPS: Record<string, FieldId<typeof productEntity.fields>> = { product_type: "type", category_name: "category" }

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

    const groupBy = search.groupBy ? PRODUCT_GROUPS[search.groupBy] ?? null : null
    const isGrouping = groupBy !== null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof productEntity.fields>> | null>(null)
    // A new filter, sort or grouping starts again at the first page.
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    // Server order by default (no sort): the header only claims an order the server applied.
    const { view, onViewChange } = useCollectionViewMode("inventory.product")
    const viewParam = searchParams.get('view')
    const isTabParam = !!viewParam && ['resumen', 'ventas', 'compras', 'existencias'].includes(viewParam)
    const initialAnalyticsTab = isTabParam && viewParam ? viewParam : 'resumen'
    // ?view=resumen|ventas|… (analytics tab links) opens the analytics view on that tab.
    const activeView = isTabParam ? "analytics" : view
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
    // Figures over the whole filtered catalog, fetched only while the analytics view is open.
    const analyticsEnabled = activeView === "analytics"
    const resumenData = useProductAnalytics(analyticsFilters, analyticsEnabled)
    const ventasData = useProductAnalytics({ ...analyticsFilters, can_be_sold: true, price_field: "sale" }, analyticsEnabled)
    const comprasData = useProductAnalytics({ ...analyticsFilters, can_be_purchased: true, price_field: "cost" }, analyticsEnabled)

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
            hidden: (items) => items.length === 0 || !items.every(p => !p.is_active),
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
            hidden: (items) => items.length === 0 || !items.every(p => p.is_active),
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

    const analyticsScreen = useMemo(
        () => buildProductAnalyticsScreen(
            { resumen: resumenData, ventas: ventasData, compras: comprasData },
            {
                activeTab: analyticsActiveTab,
                onTabChange: setAnalyticsActiveTab,
                stockReport: (
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
        ),
        [analyticsActiveTab, resumenData, ventasData, comprasData, filters],
    )

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
                view={activeView}
                onViewChange={onViewChange}
                onOpen={(product) => openSelected(product.id)}
                actions={productActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={config}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar producto..."
                    />
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
                    <AnalyticsPanelContent {...analyticsScreen} />
                </Collection.Analytics>
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            <ProductDrawer
                open={drawerOpen}
                onOpenChange={handleCloseModal}
                initialData={(selectedFromUrl || undefined) as ProductInitialData | undefined}
                onSuccess={refetch}
            />

            <ProductInsightsDrawer
                productId={selectedStockProduct ? (selectedStockProduct.id as number) : null}
                productName={selectedStockProduct?.name ?? null}
                open={!!selectedStockProduct}
                onOpenChange={(open) => { if (!open) setSelectedStockProduct(null) }}
                onProductChange={(id, name) => setSelectedStockProduct(selectedStockProduct ? { ...selectedStockProduct, id, name } : null)}
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
