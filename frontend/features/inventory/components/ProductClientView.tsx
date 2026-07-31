"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableView } from '@/components/shared'

import { type ColumnDef } from "@tanstack/react-table"

import type { BulkAction } from "@/components/shared"
import type { Page } from '@/lib/pagination'
import { ProductDrawer } from "./ProductDrawer"
import type { ProductInitialData } from "@/types/forms"
import { Plus, AlertTriangle, BarChart3, Boxes, Package, Store, Coins } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { toast } from "sonner"
import { resolveMediaUrl } from "@/features/inventory/api/inventoryApi"
import { Checkbox } from "@/components/ui/checkbox"
import { Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"

import { AutoEntityCard } from "@/components/shared"
import { productFields } from "@/features/inventory/productFields"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { useProductAnalytics } from "@/features/inventory/hooks/useProductAnalytics"
import type { AnalyticsPanelConfig } from "@/components/shared"
import { formatMoney, formatQuantity } from "@/lib/money"
import { type Product, type Restriction, type ProductFilters } from "@/features/inventory/types"
import { productActions, type ProductActionsCtx } from "@/features/inventory/productActions"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { productUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { UnifiedSearchConfig } from '@/types/unified-search'

interface ProductClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
    initialProducts?: Product[]
}

export function ProductClientView({ externalOpen, onExternalOpenChange, createAction, initialProducts }: ProductClientViewProps) {
    const { categories: categoryOptions } = useCategories()
    const categoryIconMap = useMemo(() => {
        const map = new Map<number, string | undefined>()
        for (const cat of (categoryOptions ?? [])) map.set(cat.id, cat.icon)
        return map
    }, [categoryOptions])
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

    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("catalogo")

    const analyticsData = useProductAnalytics({
        search: filters.search,
        category: filters.category,
        product_type: filters.product_type,
        can_be_sold: filters.can_be_sold,
        can_be_purchased: filters.can_be_purchased,
        is_active: filters.is_active,
    })

    const { page, products, isLoading, refetch, updateProduct } = useProducts({
        filters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
        initialData: initialProducts ? { results: initialProducts, count: initialProducts.length } as Page<Product> : undefined,
    })

    const totalCount = page?.count ?? 0
    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])


    // Restrictions state
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [targetProductName, setTargetProductName] = useState("")
    const [isRetrying, setIsRetrying] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<Product | null>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const displayProducts = React.useMemo(() => products, [products])
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

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

    const columns = useMemo<ColumnDef<Product>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="translate-y-[2px]"
                    variant="circle"
                />
            ),
            cell: ({ row }) => {
                const isChild = row.original.is_child_variant;
                if (isChild) return null;
                return (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="translate-y-[2px]"
                        variant="circle"
                    />
                )
            },
            enableSorting: false,
            enableHiding: false,
            size: 40,
            minSize: 40,
        },
        ...productFields.toColumns(),
        productActions.auto(actionsCtx),
    ], [actionsCtx])

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
                    value: "catalogo",
                    label: "Catálogo",
                    icon: BarChart3,
                    gridRows: "max-content 1fr 1fr",
                    columns: [
                        {
                            id: "col-cat-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-total-products",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Total Productos",
                                            value: formatQuantity(analyticsData.summary.totalProducts),
                                            icon: Package,
                                            accent: "primary",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "type-distribution",
                                    colSpan: 2,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución por Tipo",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Proporción del catálogo por tipo de producto",
                                            chart: { type: "pie-chart", preset: "card", data: analyticsData.typePie, valueFormat: "number", compact: true },
                                        },
                                    },
                                },
                                {
                                    id: "price-range",
                                    colSpan: 3,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Rango de Precio de Venta",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Productos por rango de precio de lista",
                                            chart: { type: "bar-chart", preset: "card", data: analyticsData.priceRangeBar, keys: ["productos"], indexBy: "rango", axisBottomLegend: "Rango", axisLeftLegend: "Productos" },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-cat-2",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-with-stock",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Con Stock",
                                            value: formatQuantity(analyticsData.summary.withStock),
                                            icon: Boxes,
                                            accent: "success",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "top-categories",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Top Categorías",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Productos por categoría",
                                            chart: { type: "bar-chart", preset: "card", data: analyticsData.categoryBar, keys: ["productos"], indexBy: "categoria", axisLeftLegend: "Productos" },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-cat-3",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-out-of-stock",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Agotados",
                                            value: formatQuantity(analyticsData.summary.outOfStock),
                                            icon: Store,
                                            accent: "warning",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "stock",
                    label: "Stock",
                    icon: Boxes,
                    gridRows: "max-content 1fr 1fr",
                    columns: [
                        {
                            id: "col-stock-1",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-total-value",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Valor de Inventario",
                                            value: formatMoney(analyticsData.summary.totalValue),
                                            icon: Coins,
                                            accent: "primary",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "top-by-value",
                                    colSpan: 2,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Top Productos por Valor de Stock",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Productos con mayor capital inmovilizado",
                                            chart: { type: "bar-chart", preset: "card", data: analyticsData.topByStockValueBar, keys: ["valor"], indexBy: "producto", axisLeftLegend: "Valor" },
                                        },
                                    },
                                },
                                {
                                    id: "top-by-units",
                                    colSpan: 2,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Top Productos por Unidades",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Productos con mayor cantidad en stock",
                                            chart: { type: "bar-chart", preset: "card", data: analyticsData.topByUnitsBar, keys: ["unidades"], indexBy: "producto", axisLeftLegend: "Unidades" },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-stock-2",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-total-units",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Unidades en Stock",
                                            value: formatQuantity(analyticsData.summary.totalUnits),
                                            icon: Package,
                                            accent: "info",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "value-by-category",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Valor por Categoría",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Distribución del valor de stock entre categorías",
                                            chart: { type: "pie-chart", preset: "card", data: analyticsData.stockValueByCategoryPie, valueFormat: "currency", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-stock-3",
                            weight: 1,
                            sections: [
                                {
                                    id: "kpi-with-stock-stock",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Con Stock",
                                            value: formatQuantity(analyticsData.summary.withStock),
                                            icon: Boxes,
                                            accent: "success",
                                            valueSize: "xl",
                                            loading: analyticsData.analyticsLoading,
                                        },
                                    },
                                },
                                {
                                    id: "value-by-type",
                                    colSpan: 1,
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Valor por Tipo",
                                            variant: "chart",
                                            loading: analyticsData.analyticsLoading,
                                            subtext: "Distribución del valor de stock por tipo de producto",
                                            chart: { type: "pie-chart", preset: "card", data: analyticsData.stockValueByTypePie, valueFormat: "currency", compact: true },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }), [analyticsActiveTab, analyticsData])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.product"
                    columns={columns}
                    data={displayProducts}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={page?.count ?? 0}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={config}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar producto..."
                    />}
                    unifiedSearchConfig={config}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    isFiltered={search.isFiltered}
                    onReset={search.clearAll}
                    renderCard={(product: Product) => {
                        const iconName = categoryIconMap.get(product.category_id)
                        const fallbackIcon = iconName
                            ? (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[iconName]
                            : undefined
                        const imageUrl = (product.image ?? product.image_thumbnail) ? resolveMediaUrl(product.image ?? product.image_thumbnail) ?? undefined : undefined

                        return (
                            <AutoEntityCard 
                                key={product.id}
                                data={product}
                                fields={productFields}
                                entityLabel="inventory.product"
                                imageSrc={imageUrl}
                                icon={imageUrl ? undefined : (fallbackIcon ?? LucideIcons.Package)}
                                iconClassName="bg-muted"
                                actions={productActions.render(product, actionsCtx)}
                                defaultAction={productActions.defaultAction(actionsCtx)?.(product) ?? null} 
                                onClick={() => openSelected(product.id)}

                            />
                        )
                    }}
                    bulkActions={bulkActions}
                    defaultPageSize={500}
                    createAction={createAction}
                    analyticsPanel={analyticsPanel}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay productos",
                        description: "Crea tu primer producto para empezar a construir el catálogo.",
                    }}
                />
            </div>

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
