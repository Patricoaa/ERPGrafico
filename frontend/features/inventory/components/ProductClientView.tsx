"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableView, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'

import { ColumnDef } from "@tanstack/react-table"

import type { BulkAction } from "@/components/shared"
import { ProductDrawer } from "./ProductDrawer"
import { ChevronDown, Plus, AlertTriangle, Layers } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, translateProductType } from "@/lib/utils"
import { resolveMediaUrl } from "@/features/inventory/api/inventoryApi"
import { useVatRate } from '@/hooks/useVatRate'
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { Checkbox } from "@/components/ui/checkbox"
import { Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"

import { DataCell, createActionsColumn, MoneyDisplay } from '@/components/shared'
import { EntityCard } from "@/components/shared"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { Product, Restriction, ProductFilters } from "@/features/inventory/types"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { Chip, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { productSearchDef } from "@/features/inventory/searchDef"

interface ProductClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
    initialProducts?: Product[]
}

export function ProductClientView({ externalOpen, onExternalOpenChange, createAction, initialProducts }: ProductClientViewProps) {
    const { rate } = useVatRate()
    const { filters: smartFilters, isFiltered } = useSmartSearch(productSearchDef)
    const filters = useMemo<ProductFilters>(() => ({
        is_active: 'all',
        parent_template__isnull: true,
        page_size: 1000,
        ...(smartFilters as Partial<ProductFilters>),
    }), [smartFilters])

    const { products, isLoading, refetch, updateProduct } = useProducts({ filters, initialData: initialProducts })
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
        products.forEach(p => {
            result.push(p)
            if (p.has_variants && expandedTemplates.has(p.id) && p.variants) {
                p.variants.forEach(v => {
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

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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
                        {product.image_thumbnail && !isChild && (
                            <Avatar className="h-7 w-7 rounded border bg-muted shrink-0">
                                <AvatarImage src={resolveMediaUrl(product.image_thumbnail) || undefined} alt={product.name} className="object-cover" />
                                <AvatarFallback className="rounded bg-muted text-[8px]"></AvatarFallback>
                            </Avatar>
                        )}
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
                                    <button
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
                                    </button>
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
        createActionsColumn<Product>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        action="edit"
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(item.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}
                    />
                    <DataCell.Action
                        action={item.is_active ? "archive" : "restore"}
                        onClick={() => handleArchive(item)}
                    />
                </>
            ),
        }),
    ], [expandedTemplates])

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
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.product"
                    columns={columns}
                    data={displayProducts}
                    isLoading={isLoading}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={productSearchDef} placeholder="Buscar producto..." className="w-full" />}
                    initialColumnVisibility={initialColumnVisibility}
                    renderCard={(product: Product) => (
                        <EntityCard key={product.id} onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(product.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}>
                            <EntityCard.Header
                                title={product.name}
                                subtitle={<span className="font-mono text-xs">{product.code}</span>}
                                trailing={
                                    <StatusBadge
                                        status={product.is_active ? "active" : "inactive"}
                                        size="sm"
                                    />
                                }
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Tipo" value={translateProductType(product.product_type)} />
                                <EntityCard.Field label="Categoría" value={product.category_name} />
                                <EntityCard.Field
                                    label="Precio Neto"
                                    value={
                                        product.is_dynamic_pricing
                                            ? <Chip size="xs" intent="warning">Dinámico</Chip>
                                            : <MoneyDisplay amount={product.sale_price} />
                                    }
                                />
                                <EntityCard.Field
                                    label="Precio Total"
                                    value={
                                        product.is_dynamic_pricing
                                            ? <Chip size="xs" intent="warning">Dinámico</Chip>
                                            : <MoneyDisplay amount={product.sale_price_gross || PricingUtils.netToGross(Number(product.sale_price))} className="text-primary" />
                                    }
                                    className="font-bold"
                                />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                    bulkActions={bulkActions}
                    defaultPageSize={500}
                    createAction={createAction}
                    isFiltered={isFiltered}
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
                initialData={editingProduct || undefined}
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
