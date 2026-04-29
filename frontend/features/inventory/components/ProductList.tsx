"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { TableRow, TableCell } from "@/components/ui/table"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ProductForm } from "./ProductForm"
import { Pencil, Archive, ChevronRight, ChevronDown, Plus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, translateProductType, formatCurrency } from "@/lib/utils"
import { resolveMediaUrl } from "@/lib/api"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { Checkbox } from "@/components/ui/checkbox"
import { LayoutGrid, List, Download, Trash2, Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsModal } from "./ArchivingRestrictionsModal"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { Product, Restriction } from "@/features/inventory/types"



interface ProductListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function ProductList({ externalOpen, onExternalOpenChange, createAction }: ProductListProps) {
    const { products, refetch, updateProduct } = useProducts({
        filters: { active: 'all', parent_template__isnull: true, page_size: 1000 }
    })
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
    const [view, setView] = useState("table")
    const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})


    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingProduct(null)
        onExternalOpenChange?.(false)
        
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
        const isArchiving = product.active
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
            await updateProduct({ id: targetProduct.id, payload: { active: !targetProduct.active } })
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
        const action = searchParams.get('action')
        const idParam = searchParams.get('id')

        if (action === 'edit' && idParam && products && products.length > 0) {
            const productId = parseInt(idParam)
            const targetProduct = products.find(p => p.id === productId)

            if (targetProduct && (!isFormOpen || editingProduct?.id !== productId)) {
                setEditingProduct(targetProduct)
                setIsFormOpen(true)

                // Clean up the URL parameters so it doesn't reopen unnecessarily on refresh
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.delete('action')
                newParams.delete('id')
                router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
            }
        }
    }, [searchParams, products, isFormOpen, editingProduct, router, pathname])

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
                <DataTableColumnHeader column={column} title="ID" className="justify-center" />
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
            cell: ({ row }) => <DataCell.Text className="font-mono text-xs">{row.getValue("code")}</DataCell.Text>,
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
                                <DataCell.Text className={cn(!product.active ? "line-through text-muted-foreground" : "", isChild && "text-[11px] text-muted-foreground/70")}>
                                    {product.name}
                                </DataCell.Text>
                                {!product.active && (
                                    <StatusBadge 
                                        status="inactive" 
                                        label="ARCHIVADO" 
                                        size="sm" 
                                        className="h-3.5"
                                    />
                                )}
                                {product.has_variants && !isChild && (
                                    <span
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-primary/20 text-primary bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-1"
                                        onClick={() => toggleExpand(product.id)}
                                    >
                                        {product.variants?.length || 0} variantes
                                        {expandedTemplates.has(product.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </span>
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
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("category_name")}</DataCell.Secondary>,
        },
        {
            accessorKey: "active",
            id: "active",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            enableHiding: true,
            filterFn: (row, id, value: string[]) => {
                if (!value || value.length === 0) return true
                const rowValue = !!row.getValue(id)
                return value.includes(String(rowValue))
            },
            cell: ({ row }) => (
                <DataCell.Status 
                    status={row.original.active ? "active" : "inactive"} 
                    label={row.original.active ? "Activo" : "Archivado"}
                />
            ),
        },
        {
            accessorKey: "product_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <DataCell.Secondary>
                    {translateProductType(row.getValue("product_type"))}
                </DataCell.Secondary>
            ),
        },

        {
            accessorKey: "sale_price",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Neto" className="justify-center" />,
            cell: ({ row }) => {
                if (row.original.is_dynamic_pricing) {
                    return (
                        <DataCell.Badge className="border-warning/30 text-warning bg-warning/5">
                            Dinámico
                        </DataCell.Badge>
                    )
                }
                return <DataCell.Currency value={row.getValue("sale_price")} />
            },
            size: 120,
            minSize: 100,
        },
        {
            id: "tax",
            header: ({ column }) => <DataTableColumnHeader column={column} title="IVA (19%)" className="justify-center" />,
            cell: ({ row }) => {
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
                        <DataCell.Badge className="border-warning/30 text-warning bg-warning/5">
                            Dinámico
                        </DataCell.Badge>
                    )
                }
                return <DataCell.Currency value={total} className="font-bold text-foreground" />
            },
            size: 130,
            minSize: 110,
        },
        {
            id: "attributes",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible para" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    {row.original.can_be_sold && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 flex items-center rounded border border-muted-foreground/30 text-muted-foreground/80 bg-muted/20">
                            Venta
                        </span>
                    )}
                    {row.original.can_be_purchased && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 flex items-center rounded border border-muted-foreground/30 text-muted-foreground/80 bg-muted/20">
                            Compra
                        </span>
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
                        icon={Pencil}
                        title="Editar"
                        onClick={() => { setEditingProduct(item); setIsFormOpen(true); }}
                    />
                    <DataCell.Action
                        icon={item.active ? Archive : Plus}
                        title={item.active ? "Archivar" : "Restaurar"}
                        className={item.active ? "text-destructive" : "text-success"}
                        onClick={() => handleArchive(item)}
                    />
                </>
            ),
        }),
    ], [expandedTemplates])

    const globalFilterFields = useMemo(() => ["name", "code", "internal_code"], [])
    const initialColumnVisibility = useMemo(() => ({ active: false }), [])

    const selectedProducts = useMemo(() => {
        const ids = Object.keys(selectedRows).map(Number)
        // Note: we need to find the products in displayProducts because displayProducts contains variants too
        return displayProducts.filter((_, index) => selectedRows[index])
    }, [selectedRows, displayProducts])

    const canArchiveAll = useMemo(() => {
        if (selectedProducts.length === 0) return false
        return selectedProducts.every(p => p.active)
    }, [selectedProducts])

    const canRestoreAll = useMemo(() => {
        if (selectedProducts.length === 0) return false
        return selectedProducts.every(p => !p.active)
    }, [selectedProducts])

    const handleBulkArchive = async () => {
        if (selectedProducts.length === 0) return
        const action = "archivar"
        try {
            await Promise.all(selectedProducts.map(p => updateProduct({ id: p.id, payload: { active: false } })))
            toast.success(`${selectedProducts.length} productos archivados correctamente.`)
            setSelectedRows({})
            refetch()
        } catch (error) {
            showApiError(error, `Error al ${action} los productos.`)
        }
    }

    const handleBulkRestore = async () => {
        if (selectedProducts.length === 0) return
        const action = "restaurar"
        try {
            await Promise.all(selectedProducts.map(p => updateProduct({ id: p.id, payload: { active: true } })))
            toast.success(`${selectedProducts.length} productos restaurados correctamente.`)
            setSelectedRows({})
            refetch()
        } catch (error) {
            toast.error(`Error al ${action} los productos.`)
        }
    }


    return (
        <div className="space-y-4">
            <div className="">
                <DataTable
                    columns={columns}
                    data={displayProducts}
                    cardMode
                    globalFilterFields={globalFilterFields}
                    searchPlaceholder="Buscar por nombre, SKU o código..."
                    initialColumnVisibility={initialColumnVisibility}
                    viewOptions={[
                        { label: "Lista", value: "table", icon: List },
                        { label: "Grilla", value: "grid", icon: LayoutGrid },
                    ]}
                    currentView={view}
                    onViewChange={setView}
                    onRowSelectionChange={setSelectedRows}
                    batchActions={
                        <>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-white hover:bg-white/10 gap-2 disabled:opacity-30"
                                onClick={handleBulkRestore}
                                disabled={!canRestoreAll}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Restaurar
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-destructive-foreground hover:bg-destructive/20 gap-2 disabled:opacity-30"
                                onClick={handleBulkArchive}
                                disabled={!canArchiveAll}
                            >
                                <ArchiveIcon className="h-3.5 w-3.5" />
                                Archivar
                            </Button>
                        </>
                    }
                    facetedFilters={[
                        {
                            column: "category_name",
                            title: "Categoría",
                        },
                        {
                            column: "product_type",
                            title: "Tipo",
                            options: [
                                { label: "Almacenable", value: "STORABLE" },
                                { label: "Consumible", value: "CONSUMABLE" },
                                { label: "Servicio", value: "SERVICE" },
                                { label: "Fabricable", value: "MANUFACTURABLE" },
                                { label: "Suscripción", value: "SUBSCRIPTION" },
                            ],
                        },
                        {
                            column: "active",
                            title: "Estado",
                            options: [
                                { label: "Activos", value: "true" },
                                { label: "Archivados", value: "false" },
                            ],
                        }
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={500}
                    createAction={createAction}
                />
            </div>

            <ProductForm
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
                title={currentArchivingProduct?.active ? "Archivar Producto" : "Restaurar Producto"}
                variant={currentArchivingProduct?.active ? "warning" : "default"}
                onConfirm={() => { if (currentArchivingProduct) return handleArchive(currentArchivingProduct, true) }}
                confirmText={currentArchivingProduct?.active ? "Archivar" : "Restaurar"}
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea {currentArchivingProduct?.active ? "archivar" : "restaurar"} el producto{" "}
                            <strong>{currentArchivingProduct?.name}</strong>?
                        </p>

                        {currentArchivingProduct?.active && currentArchivingProduct?.product_type === 'SUBSCRIPTION' && (
                            <div className="bg-warning/10 border border-warning/10 p-3 rounded-md flex gap-3 text-warning">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div className="text-xs">
                                    <p className="font-bold mb-1">Impacto en Suscripciones</p>
                                    <p>Al archivar este producto, sus suscripciones activas/pausadas se ocultarán del gestor hasta que el producto sea restaurado.</p>
                                </div>
                            </div>
                        )}

                        {!currentArchivingProduct?.active && currentArchivingProduct?.product_type === 'SUBSCRIPTION' && (
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
