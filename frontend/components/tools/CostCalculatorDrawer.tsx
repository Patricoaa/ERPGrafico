"use client"

import React, { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Trash2, Calculator, Info, Minus, Plus } from "lucide-react"
import { Drawer } from '@/components/shared'
import { ProductSelector } from "@/components/shared"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"

import {
    POSSearchSkeleton,
    POSGridSkeleton,
    POSCartItemsSkeleton
} from "@/features/pos"

interface Product {
    id: number
    name: string
    internal_code: string
    code?: string
    barcode?: string
    image?: string
    cost_price: number
    product_type: string
    track_inventory: boolean
    uom_name?: string
    uom?: number
    available_uoms?: Array<{ id: number; name: string; ratio: number }>
    has_bom?: boolean
    requires_advanced_manufacturing?: boolean
    category?: number | { id: number; name: string; icon?: string | null }
}

interface SelectedItem {
    id: string
    product: Product
    quantity: number
    uom_id: number
    uom_name: string
    unit_cost: number
    subtotal: number
}

interface CostCalculatorDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

import { useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { useWindowWidth } from "@/hooks/useWindowWidth"

export function CostCalculatorDrawer({ open, onOpenChange }: CostCalculatorDrawerProps) {
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const idCounterRef = React.useRef(0)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

    const windowWidth = useWindowWidth(150, open)

    const fullWidth = Math.min(windowWidth * 0.85, 1600)

    const { products: rawProducts = [], isLoading: loadingProducts } = useProducts({
        filters: {
            is_active: true,
            track_inventory: true,
            fields: 'id,name,cost_price,image,uom_name,internal_code,barcode,product_type,available_uoms,category,uom'
        }
    })
    const products = rawProducts as any as Product[]

    const { categories = [], isLoading: loadingCategories } = useCategories()

    const loading = loadingProducts || loadingCategories

    const addItem = (product: Product) => {
        const existingItem = selectedItems.find(item => item.product.id === product.id)
        if (existingItem) {
            updateQuantity(existingItem.id, existingItem.quantity + 1)
            return
        }

        const baseUomId = Number(product.uom)
        const selectedUom = product.available_uoms?.find(u => u.id === baseUomId) || product.available_uoms?.[0]

        if (!selectedUom) {
            toast.error("Producto sin unidad de medida configurada")
            return
        }

        const costPrice = Number(product.cost_price) || 0

        idCounterRef.current += 1

        const newItem: SelectedItem = {
            id: `${product.id}-${idCounterRef.current}`,
            product,
            quantity: 1,
            uom_id: selectedUom.id,
            uom_name: selectedUom.name,
            unit_cost: costPrice,
            subtotal: costPrice
        }

        setSelectedItems([...selectedItems, newItem])
    }

    const removeItem = (itemId: string) => {
        setSelectedItems(selectedItems.filter(item => item.id !== itemId))
    }

    const updateQuantity = (itemId: string, quantity: number) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.id === itemId) {
                const newQuantity = Number(quantity) || 0
                return {
                    ...item,
                    quantity: Math.max(0, newQuantity),
                    subtotal: Math.max(0, newQuantity) * Number(item.unit_cost)
                }
            }
            return item
        }))
    }

    const updateUom = (itemId: string, uomId: number) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.id === itemId) {
                const uom = item.product.available_uoms?.find(u => u.id === uomId)
                if (uom) {
                    return {
                        ...item,
                        uom_id: uomId,
                        uom_name: uom.name
                    }
                }
            }
            return item
        }))
    }

    const totalCost = selectedItems.reduce((sum, item) => sum + item.subtotal, 0)

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())

        const categoryId = typeof p.category === 'object' ? p.category?.id : p.category
        const matchesCategory = selectedCategoryId === null || categoryId === selectedCategoryId

        const isStorable = p.product_type === 'STORABLE'
        const isSimple = !p.requires_advanced_manufacturing

        return matchesSearch && matchesCategory && isStorable && isSimple
    })

    const handleClose = () => {
        setSelectedItems([])
        setSearchTerm("")
        setSelectedCategoryId(null)
        onOpenChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            title="Calculadora de Costos"
            subtitle="Simulación rápida de materiales para determinar costos de producción"
            icon={Calculator}
            side="bottom"
            boundary="embedded"
            resizable={false}
            showOverlay={true}
            defaultSize="100%"
            contentClassName="p-0 flex flex-col overflow-hidden"
        >
            <div className="flex-1 overflow-hidden flex">
                {/* Panel Izquierdo: Catálogo */}
                <div className="w-[60%] flex flex-col p-4 gap-4 min-h-0">
                    {loading ? (
                        <Card className="flex-1 flex flex-col overflow-hidden shadow-none border bg-muted/10 py-1.5">
                            <div className="px-2 pt-1.5 pb-1.5 border-b">
                                <POSSearchSkeleton />
                            </div>
                            <div className="p-6">
                                <POSGridSkeleton count={8} />
                            </div>
                        </Card>
                    ) : (
                        <ProductSelector
                            products={filteredProducts as any}
                            categories={categories as any}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            selectedCategoryId={selectedCategoryId}
                            onSelectCategory={setSelectedCategoryId}
                            onProductClick={(p) => addItem(p as any)}
                            priceRenderer={(product) => (
                                <>
                                    <span className="text-base font-black text-primary">
                                        {formatCurrency((product as any).cost_price || 0)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-1 uppercase">
                                        /{(product as any).uom_name || "UN"}
                                    </span>
                                </>
                            )}
                        />
                    )}
                </div>

                {/* Panel Derecho: Selección */}
                <div className="w-[45%] flex flex-col p-4 gap-4 min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-none border">
                        <ScrollArea className="flex-1">
                            {loading ? (
                                <POSCartItemsSkeleton count={6} />
                            ) : selectedItems.length === 0 ? (
                                <div className="h-[300px] flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-4">
                                    <div className="h-16 w-16 rounded-sm flex items-center justify-center">
                                        <Calculator className="h-8 w-8 text-muted-foreground/20" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Tu lista está vacía</p>
                                        <p className="max-w-[200px] text-[11px] italic opacity-70">
                                            Agrega productos del catálogo para calcular costos.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-3">
                                    {selectedItems.map((item, index) => (
                                        <div key={item.id} className="flex flex-col gap-1 p-3 rounded-lg border border-border/40 bg-card/5 group">
                                            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto_auto] gap-x-1 items-start">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold truncate">{item.product.name}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{formatCurrency(item.unit_cost)}/u</span>
                                                </div>

                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-0">
                                                        <button
                                                            className="rounded-full h-8 w-8 border-2 border-primary/20 hover:border-primary hover:bg-primary/5 shrink-0 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                                            onClick={() => {
                                                                const qty = Math.max(0.01, item.quantity - 1)
                                                                updateQuantity(item.id, qty)
                                                            }}
                                                            disabled={item.quantity <= 0.01}
                                                            type="button"
                                                        >
                                                            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </button>

                                                        <span className="w-10 text-center text-sm font-bold">{item.quantity}</span>

                                                        <button
                                                            className="rounded-full h-8 w-8 border-2 border-primary/20 hover:border-primary hover:bg-primary/5 shrink-0 flex items-center justify-center transition-colors"
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            type="button"
                                                        >
                                                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </button>
                                                    </div>
                                                    <div className="flex justify-center mt-0.5">
                                                        <Select value={String(item.uom_id ?? '')} onValueChange={val => updateUom(item.id, parseInt(val))}>
                                                            <SelectTrigger className="h-5 text-[9px] border-muted-foreground/20 px-1.5 py-0 bg-background min-w-0">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(item.product.available_uoms || []).map(uom => (
                                                                    <SelectItem key={uom.id} value={String(uom.id)} className="text-[9px] py-0.5">
                                                                        {uom.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div />
                                                <div />

                                                <div className="flex flex-col items-end ml-6">
                                                    <span className="text-sm font-bold text-primary leading-none">{formatCurrency(item.subtotal)}</span>
                                                </div>

                                                <div>
                                                    <button
                                                        className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-all h-8 w-8 rounded-full hover:bg-destructive/10"
                                                        onClick={() => removeItem(item.id)}
                                                        type="button"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Totals Section Align with POS */}
                        <div className="p-6 border-t space-y-4 shrink-0">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                    <span>Costo Neto</span>
                                    <span>{formatCurrency(totalCost)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                    <span>IVA Estimado (19%)</span>
                                    <span>{formatCurrency(Math.round(totalCost * 0.19))}</span>
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-primary uppercase tracking-tighter">
                                            Total
                                        </span>
                                    </div>
                                    <span className="text-3xl font-black text-primary tracking-tighter">
                                        {formatCurrency(Math.round(totalCost * 1.19))}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-primary/5 border border-primary/10 rounded-sm p-3 flex items-start gap-3">
                                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <p className="text-[10px] text-primary/80 leading-relaxed font-medium uppercase tracking-tight">
                                    Esta es una simulación de costos de producción basada en el precio de costo de los materiales seleccionados. No afecta movimientos de stock ni genera registros comerciales.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </Drawer>
    )
}
