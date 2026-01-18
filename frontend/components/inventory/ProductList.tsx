"use client"

import React, { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { ProductForm } from "@/components/forms/ProductForm"
import { Pencil, Archive, ChevronRight, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn, translateProductType } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { ArchivingRestrictionsDialog, type Restriction } from "./ArchivingRestrictionsDialog"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { AlertTriangle } from "lucide-react"

interface Product {
    id: number
    code: string
    internal_code: string
    name: string
    product_type: string
    category_id: number
    category_name: string
    sale_price: string
    current_stock: number
    qty_reserved?: number
    qty_available?: number
    total_stock: number
    manufacturable_quantity?: number | null
    uom_name: string
    purchase_uom_name: string
    track_inventory: boolean
    can_be_sold: boolean
    can_be_purchased: boolean
    active: boolean
}

export function ProductList() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    // Restrictions state
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [targetProductName, setTargetProductName] = useState("")
    const [isRetrying, setIsRetrying] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<Product | null>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

    const fetchProducts = async () => {
        setLoading(true)
        try {
            // Fetch all products so the faceted filter can handle actives vs archived
            const params = { active: 'all' }
            const response = await api.get('/inventory/products/', { params })
            const data = response.data.results || response.data
            setProducts(data)
        } catch (error) {
            console.error("Failed to fetch products", error)
            toast.error("Error al cargar los productos.")
        } finally {
            setLoading(false)
        }
    }

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
            await api.patch(`/inventory/products/${targetProduct.id}/`, { active: !targetProduct.active })
            toast.success(`Producto ${isArchiving ? 'archivado' : 'restaurar'} correctamente.`, {
                description: targetProduct.product_type === 'SUBSCRIPTION'
                    ? `Las suscripciones asociadas han sido ${isArchiving ? 'ocultas' : 'restauradas en la lista'}.`
                    : undefined
            })
            setIsRestrictionsDialogOpen(false)
            setIsConfirmModalOpen(false)
            fetchProducts()
        } catch (error: any) {
            console.error(`Error ${action} product:`, error)

            if (error.response?.status === 400 && error.response?.data?.restrictions) {
                setTargetProductName(targetProduct.name)
                setRestrictions(error.response.data.restrictions)
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

    useEffect(() => {
        fetchProducts()
    }, [])

    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "internal_code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código Int." />
            ),
            cell: ({ row }) => (
                <div className="font-mono text-[10px] font-bold text-primary">
                    {row.getValue("internal_code")}
                    {!row.original.active && (
                        <Badge variant="destructive" className="ml-1 text-[8px] h-3 px-1">ARCHIVADO</Badge>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="SKU/Código" />
            ),
            cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("code") || '-'}</div>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => (
                <div className={cn("font-medium", !row.original.active && "text-muted-foreground line-through")}>
                    {row.getValue("name")}
                </div>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Categoría" />
            ),
            cell: ({ row }) => <div className="text-sm">{row.getValue("category_name")}</div>,
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
                <Badge variant="secondary" className="text-[10px]">{translateProductType(row.getValue("product_type"))}</Badge>
            ),
        },
        {
            id: "stock",
            header: ({ column }) => (
                <div className="text-right">Stock</div>
            ),
            cell: ({ row }) => {
                const product = row.original
                return (
                    <div className="text-right font-bold tabular-nums flex justify-end">
                        {product.track_inventory ? (
                            <div className="flex flex-col items-end gap-0.5 text-[10px]">
                                <div className="flex gap-2 justify-between w-full min-w-[80px]">
                                    <span className="text-muted-foreground font-normal">Físico:</span>
                                    <span>{product.current_stock || 0}</span>
                                </div>
                                {(product.qty_reserved || 0) > 0 && (
                                    <div className="flex gap-2 justify-between w-full min-w-[80px] text-amber-600">
                                        <span className="font-normal">Reserv:</span>
                                        <span>{product.qty_reserved}</span>
                                    </div>
                                )}
                                <div className="flex gap-2 justify-between w-full min-w-[80px] border-t border-dashed pt-0.5 mt-0.5">
                                    <span className="text-emerald-600 font-bold">Disp:</span>
                                    <span className="text-emerald-600 font-bold">{product.qty_available || 0}</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground font-normal mt-0.5">{product.uom_name}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                {product.product_type === 'MANUFACTURABLE' ? (
                                    <div className="flex flex-col items-end gap-0.5">
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 h-4">Fabricable</Badge>
                                        <span className="text-[10px] text-blue-600 font-medium">
                                            {product.manufacturable_quantity !== null && product.manufacturable_quantity !== undefined
                                                ? `${product.manufacturable_quantity} disp.`
                                                : 'Disponible'}
                                        </span>
                                    </div>
                                ) : product.product_type === 'SERVICE' ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 h-4">Disponible</Badge>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground font-normal">No controlado</span>
                                )}
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "sale_price",
            header: ({ column }) => (
                <div className="text-right">Neto</div>
            ),
            cell: ({ row }) => <div className="text-right font-bold text-muted-foreground">{formatCurrency(row.getValue("sale_price"))}</div>,
        },
        {
            id: "tax",
            header: ({ column }) => (
                <div className="text-right">IVA (19%)</div>
            ),
            cell: ({ row }) => <div className="text-right text-muted-foreground text-xs">{formatCurrency(PricingUtils.calculateTax(Number(row.getValue("sale_price"))))}</div>,
        },
        {
            id: "total",
            header: ({ column }) => (
                <div className="text-right">Total</div>
            ),
            cell: ({ row }) => <div className="text-right font-bold text-primary">{formatCurrency(PricingUtils.netToGross(Number(row.getValue("sale_price"))))}</div>,
        },
        {
            id: "attributes",
            header: ({ column }) => (
                <div className="text-center">Atributos</div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    {row.original.can_be_sold && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 h-4">Venta</Badge>
                    )}
                    {row.original.can_be_purchased && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 h-4">Compra</Badge>
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
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Catálogo de Productos</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                    </Button>
                </div>
            </div>

            <div className="">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-muted-foreground">Cargando productos...</div>
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={products}
                        globalFilterFields={["name", "code", "internal_code"]}
                        searchPlaceholder="Buscar por nombre, SKU o código..."
                        initialColumnVisibility={{ active: false }}
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
                    />)}
            </div>

            <ProductForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) setEditingProduct(null)
                }}
                initialData={editingProduct}
                onSuccess={fetchProducts}
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
                            <p className="text-xs bg-blue-50 text-blue-700 p-2 rounded-md">
                                Al restaurar el producto, sus suscripciones volverán a aparecer en el gestor central.
                            </p>
                        )}
                    </div>
                }
            />
        </div >
    )
}
