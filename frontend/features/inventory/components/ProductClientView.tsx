"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableView, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'

import { type ColumnDef } from "@tanstack/react-table"

import type { BulkAction } from "@/components/shared"
import type { Page } from '@/lib/pagination'
import { ProductDrawer } from "./ProductDrawer"
import type { ProductInitialData } from "@/types/forms"
import { ChevronDown, Plus, AlertTriangle, Layers } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { toast } from "sonner"
import { cn, translateProductType } from "@/lib/utils"
import { resolveMediaUrl } from "@/features/inventory/api/inventoryApi"
import { useVatRate } from '@/hooks/useVatRate'
import { PricingUtils } from '@/lib/pricing-utils'
import { Checkbox } from "@/components/ui/checkbox"
import { Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"

import { DataCell, MoneyDisplay } from '@/components/shared'
import { EntityCard } from "@/components/shared"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { type Product, type Restriction, type ProductFilters } from "@/features/inventory/types"
import { productActions, type ProductActionsCtx } from "@/features/inventory/productActions"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { Chip, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { productUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { Button } from "@/components/ui/button"

interface ProductClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
    initialProducts?: Product[]
}

export function ProductClientView({ externalOpen, onExternalOpenChange, createAction, initialProducts }: ProductClientViewProps) {
    const { rate } = useVatRate()
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
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    // Restrictions state
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [targetProductName, setTargetProductName] = useState("")
    const [isRetrying, setIsRetrying] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<Product | null>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [expandedTemplates, setExpandedTemplates] = useState<Set<number>>(new Set())

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection: clearUrlSelection } = useSelectedEntity<Product>({
        endpoint: '/inventory/products'
    })

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingProduct(null)
        onExternalOpenChange?.(false)
        clearUrlSelection()

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            params.delete("action")
            params.delete("id")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const toggleExpand = (templateId: number) => {
        setExpandedTemplates(prev => {
            const next = new Set(prev)
            if (next.has(templateId)) next.delete(templateId)
            else next.add(templateId)
            return next
        })
    }

    const displayProducts = React.useMemo(() => {
        const result: Product[] = []
        products.forEach((p: Product) => {
            result.push(p)
            if (p.has_variants && expandedTemplates.has(p.id) && p.variants) {
                p.variants.forEach((v: Product) => {
                    result.push({ ...v, is_child_variant: true })
                })
            }
        })
        return result
    }, [products, expandedTemplates])

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

    // Initial fetch handled by Suspense

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setEditingProduct(selectedFromUrl)
                setIsFormOpen(true)
            })
        } else {
            requestAnimationFrame(() => {
                setIsFormOpen(false)
                setEditingProduct(null)
            })
        }
    }, [selectedFromUrl])


    const actionsCtx: ProductActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
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
        {
            accessorKey: "internal_code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />
            ),
            cell: ({ row }) => (
                <DataCell.Code>
                    {row.getValue("internal_code")}
                </DataCell.Code>
            ),
            size: 100,
            minSize: 80,
        },
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="SKU" className="justify-center" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.getValue("code")}</DataCell.Code>,
            size: 100,
            minSize: 80,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />
            ),
            cell: ({ row }) => {
                const product = row.original;
                const isChild = product.is_child_variant;
                return (
                    <div className={cn("w-full flex items-center justify-center gap-2", isChild && "pl-8")}>
                        {isChild && <div className="h-4 w-4 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg -mt-2" />}

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <DataCell.Text>
                                    {product.name}
                                </DataCell.Text>
                                {!product.is_active && (
                                    <StatusBadge
                                        status="inactive"
                                        label="ARCHIVADO"
                                        size="sm"
                                        className="h-3.5"
                                    />
                                )}
                                {product.has_variants && !isChild && (
                                    <Button
                                        onClick={() => toggleExpand(product.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-1 transition-all duration-200 group/var",
                                            expandedTemplates.has(product.id)
                                                ? "text-primary"
                                                : "text-muted-foreground/60 hover:text-primary"
                                        )}
                                    >
                                        <Layers className={cn(
                                            "h-3 w-3 transition-transform",
                                            expandedTemplates.has(product.id) ? "scale-110" : "opacity-70 group-hover/var:opacity-100"
                                        )} />
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em]">
                                            {product.variants?.length || 0} Variantes
                                        </span>
                                        <ChevronDown className={cn(
                                            "h-3 w-3 transition-transform duration-300",
                                            expandedTemplates.has(product.id) ? "rotate-180" : "opacity-40 group-hover/var:opacity-100"
                                        )} />
                                    </Button>
                                )}
                            </div>
                            {isChild && product.variant_display_name && (
                                <span className="text-[9px] font-bold text-primary uppercase">{product.variant_display_name}</span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("category_name")}</DataCell.Text>,
        },
        {
            accessorKey: "is_active",
            id: "is_active",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            enableHiding: true,
            cell: ({ row }) => (
                <DataCell.Status
                    status={row.original.is_active ? "active" : "inactive"}
                    label={row.original.is_active ? "Activo" : "Archivado"}
                />
            ),
        },
        {
            accessorKey: "product_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>
                    {translateProductType(row.getValue("product_type"))}
                </DataCell.Text>
            ),
        },

        {
            accessorKey: "sale_price",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Neto" className="justify-center" />,
            cell: ({ row }) => {
                if (row.original.is_dynamic_pricing) {
                    return (
                        <div className="flex justify-center w-full">
                            <Chip size="xs" intent="warning">Dinámico</Chip>
                        </div>
                    )
                }
                return <DataCell.Currency value={row.getValue("sale_price")} />
            },
            size: 120,
            minSize: 100,
        },
        {
            id: "tax",
            header: ({ column }) => <DataTableColumnHeader column={column} title={`IVA (${rate}%)`} className="justify-center" />,
            cell: ({ row }) => {
                if (row.original.is_dynamic_pricing) {
                    return (
                        <div className="flex justify-center w-full">
                            <Chip size="xs" intent="warning">Dinámico</Chip>
                        </div>
                    )
                }
                const tax = PricingUtils.calculateTax(Number(row.getValue("sale_price")))
                return <DataCell.Currency value={tax} />
            },
            size: 110,
            minSize: 90,
        },
        {
            id: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total (c/IVA)" className="justify-center" />,
            cell: ({ row }) => {
                const total = row.original.sale_price_gross || PricingUtils.netToGross(Number(row.getValue("sale_price")))
                if (row.original.is_dynamic_pricing) {
                    return (
                        <div className="flex justify-center w-full">
                            <Chip size="xs" intent="warning">Dinámico</Chip>
                        </div>
                    )
                }
                return <DataCell.Currency value={total} />
            },
            size: 130,
            minSize: 110,
        },
        {
            id: "availability",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible para" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    {row.original.can_be_sold && (
                        <Chip size="xs">Venta</Chip>
                    )}
                    {row.original.can_be_purchased && (
                        <Chip size="xs">Compra</Chip>
                    )}
                    {!row.original.can_be_sold && !row.original.can_be_purchased && (
                        <span className="text-[10px] text-muted-foreground italic">Ninguno</span>
                    )}
                </div>
            ),
        },
        productActions.column(actionsCtx),
    ], [actionsCtx, expandedTemplates])

    const initialColumnVisibility = useMemo(() => ({ is_active: false }), [])

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
                    initialColumnVisibility={initialColumnVisibility}
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
                            <EntityCard key={product.id} onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('selected', String(product.id))
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }}>
                                <EntityCard.Header
                                    imageSrc={imageUrl}
                                    icon={imageUrl ? undefined : (fallbackIcon ?? LucideIcons.Package)}
                                    iconClassName="bg-muted"
                                    title={product.name}
                                    subtitle={
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs">{product.code}</span>
                                            <StatusBadge
                                                status={product.is_active ? "active" : "inactive"}
                                                size="sm"
                                            />
                                        </div>
                                    }
                                    trailing={
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Total</span>
                                            {product.is_dynamic_pricing
                                                ? <Chip size="xs" intent="warning">Dinámico</Chip>
                                                : <MoneyDisplay amount={product.sale_price_gross || PricingUtils.netToGross(Number(product.sale_price))} className="text-primary font-bold" />
                                            }
                                        </div>
                                    }
                                />
                                <EntityCard.Body actions={productActions.render(product, actionsCtx)}>
                                    <EntityCard.Field label="Tipo" value={translateProductType(product.product_type)} />
                                    <EntityCard.Field label="Categoría" value={product.category_name} />
                                    <EntityCard.Field
                                        label="Código Interno"
                                        value={product.internal_code || <span className="text-muted-foreground/40">—</span>}
                                    />
                                </EntityCard.Body>
                            </EntityCard>
                        )
                    }}
                    bulkActions={bulkActions}
                    defaultPageSize={500}
                    createAction={createAction}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay productos",
                        description: "Crea tu primer producto para empezar a construir el catálogo.",
                    }}
                />
            </div>

            <ProductDrawer
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
                    }
                }}
                initialData={(editingProduct || undefined) as ProductInitialData | undefined}
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
