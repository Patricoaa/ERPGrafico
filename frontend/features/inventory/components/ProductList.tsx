"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { TableRow, TableCell } from "@/components/ui/table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ProductForm } from "./ProductForm"
import { Pencil, Archive, ChevronRight, ChevronDown, Plus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn, translateProductType, formatCurrency } from "@/lib/utils"
import { PricingUtils } from "@/lib/pricing"
import { Checkbox } from "@/components/ui/checkbox"
import { LayoutGrid, List, Download, Trash2, Archive as ArchiveIcon } from "lucide-react"
import { ArchivingRestrictionsDialog } from "./ArchivingRestrictionsDialog"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DataCell } from "@/components/ui/data-table-cells"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { Product, Restriction } from "@/features/inventory/types"



interface ProductListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function ProductList({ externalOpen, onExternalOpenChange }: ProductListProps) {
    const { products, refetch, updateProduct } = useProducts({
        filters: { active: 'all', parent_template__isnull: true }
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

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
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
        const result: any[] = []
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
            const err = error as any;
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
        if (externalOpen) {
            setEditingProduct(null)
            setIsFormOpen(true)
        }
    }, [externalOpen])

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
                router.replace(`${pathname}?${newParams.toString()}`)
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
                const isChild = (row.original as any).is_child_variant;
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
                <DataTableColumnHeader column={column} title="Cód. Interno" />
            ),
            cell: ({ row }) => (
                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                    {row.getValue("internal_code")}
                </Badge>
            ),
            size: 100,
            minSize: 80,
        },
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="SKU" />
            ),
            cell: ({ row }) => (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                    {row.getValue("code")}
                </Badge>
            ),
            size: 100,
            minSize: 80,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => {
                const product = row.original as any;
                const isChild = product.is_child_variant;
                return (
                    <div className={cn("max-w-[250px] flex items-center gap-2", isChild && "ml-8")}>
                        {isChild && <div className="h-4 w-4 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg -mt-2" />}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <DataCell.Text className={cn(!product.active ? "line-through text-muted-foreground" : "", isChild && "text-[11px] text-muted-foreground/70")}>
                                    {product.name}
                                </DataCell.Text>
                                {!product.active && <Badge variant="destructive" className="text-[8px] h-3 px-1 ml-1">ARCHIVADO</Badge>}
                                {product.has_variants && !isChild && (
                                    <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 cursor-pointer hover:bg-primary/10"
                                        onClick={() => toggleExpand(product.id)}
                                    >
                                        {product.variants?.length || 0} variantes
                                        {expandedTemplates.has(product.id) ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
                                    </Badge>
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
                <DataTableColumnHeader column={column} title="Categoría" />
            ),
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("category_name")}</DataCell.Secondary>,
        },
        {
            accessorKey: "active",
            id: "active",
            header: "Estado",
            enableHiding: true,
            filterFn: (row, id, value: string[]) => {
                if (!value || value.length === 0) return true
                const rowValue = !!row.getValue(id)
                return value.includes(String(rowValue))
            },
        },
        {
            accessorKey: "product_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => (
                <DataCell.Badge variant="secondary" className="text-[10px]">{translateProductType(row.getValue("product_type"))}</DataCell.Badge>
            ),
        },

        {
            accessorKey: "sale_price",
            header: ({ column }) => (
                <div className="text-right">Neto</div>
            ),
            cell: ({ row }) => {
                if (row.original.is_dynamic_pricing) {
                    return <div className="text-right"><DataCell.Badge variant="warning" className="text-[9px]">Precio Dinámico</DataCell.Badge></div>
                }
                return <DataCell.Currency value={row.getValue("sale_price")} className="text-muted-foreground font-bold" />
            },
            size: 120,
            minSize: 100,
        },
        {
            id: "tax",
            header: ({ column }) => (
                <div className="text-right">IVA (19%)</div>
            ),
            cell: ({ row }) => {
                const tax = PricingUtils.calculateTax(Number(row.getValue("sale_price")))
                return <DataCell.Currency value={tax} className="text-xs text-muted-foreground font-normal" />
            },
            size: 110,
            minSize: 90,
        },
        {
            id: "total",
            header: ({ column }) => (
                <div className="text-right">Total (c/IVA)</div>
            ),
            cell: ({ row }) => {
                const total = row.original.sale_price_gross || PricingUtils.netToGross(Number(row.getValue("sale_price")))
                if (row.original.is_dynamic_pricing) {
                    return <div className="text-right"><DataCell.Badge variant="warning" className="text-[9px]">Precio Dinámico</DataCell.Badge></div>
                }
                return <DataCell.Currency value={total} className="text-primary font-bold" />
            },
            size: 130,
            minSize: 110,
        },
        {
            id: "attributes",
            header: ({ column }) => (
                <div className="text-center">Disponible para</div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    {row.original.can_be_sold && (
                        <DataCell.Badge variant="success" className="text-[9px] px-1.5 py-0 h-4">Venta</DataCell.Badge>
                    )}
                    {row.original.can_be_purchased && (
                        <DataCell.Badge variant="info" className="text-[9px] px-1.5 py-0 h-4">Compra</DataCell.Badge>
                    )}
                    {!row.original.can_be_sold && !row.original.can_be_purchased && (
                        <span className="text-[10px] text-muted-foreground italic">Ninguno</span>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingProduct(row.original); setIsFormOpen(true); }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", row.original.active ? "text-destructive" : "text-emerald-600")}
                        onClick={() => handleArchive(row.original)}
                        title={row.original.active ? "Archivar" : "Restaurar"}
                    >
                        {row.original.active ? <Archive className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
            ),
        },
    ], [expandedTemplates])

    const globalFilterFields = useMemo(() => ["name", "code", "internal_code"], [])
    const initialColumnVisibility = useMemo(() => ({ active: false }), [])


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
                    batchActions={
                        <>
                            <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/10 gap-2">
                                <Download className="h-3.5 w-3.5" />
                                Exportar
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-destructive-foreground hover:bg-destructive/20 gap-2">
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
                />
            </div>

            <ProductForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) {
                        setEditingProduct(null)
                        onExternalOpenChange?.(false)
                        handleCloseModal() // Clean URL
                    }
                }}
                initialData={editingProduct || undefined}
                onSuccess={refetch}
            />

            <ArchivingRestrictionsDialog
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
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3 text-amber-800">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div className="text-xs">
                                    <p className="font-bold mb-1">Impacto en Suscripciones</p>
                                    <p>Al archivar este producto, sus suscripciones activas/pausadas se ocultarán del gestor hasta que el producto sea restaurado.</p>
                                </div>
                            </div>
                        )}

                        {!currentArchivingProduct?.active && currentArchivingProduct?.product_type === 'SUBSCRIPTION' && (
                            <p className="text-xs bg-blue-50 text-primary p-2 rounded-md">
                                Al restaurar el producto, sus suscripciones volverán a aparecer en el gestor central.
                            </p>
                        )}
                    </div>
                }
            />
        </div >
    )
}
