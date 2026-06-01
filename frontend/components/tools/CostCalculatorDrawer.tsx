"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Trash2, Calculator, Info } from "lucide-react"
import { Drawer, DynamicIcon } from '@/components/shared'
import { ProductSelector } from "@/components/shared"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"
import { resolveMediaUrl } from "@/lib/api"

import {
    POSSearchSkeleton,
    POSGridSkeleton,
    POSCartItemsSkeleton
} from "@/features/pos/components/skeletons/POSLayoutSkeleton"

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
            active: true,
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
            <div className="flex-1 overflow-hidden flex divide-x">
                {/* Panel Izquierdo: Catálogo */}
                <div className="w-[60%] flex flex-col p-4 gap-4 bg-muted/20 min-h-0">
                    {loading ? (
                        <Card className="flex-1 flex flex-col overflow-hidden shadow-none border bg-background">
                            <POSSearchSkeleton />
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
                <div className="w-[40%] flex flex-col p-4 bg-muted/10 gap-4 min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-none border bg-background">
                        {/* List Header */}
                        <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-muted/20 border-b text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest shrink-0">
                            <div className="col-span-6">Descripción</div>
                            <div className="col-span-2 text-center">Cantidad</div>
                            <div className="col-span-2">Unidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                        </div>

                        <ScrollArea className="flex-1">
                            {loading ? (
                                <POSCartItemsSkeleton count={6} />
                            ) : selectedItems.length === 0 ? (
                                <div className="h-[300px] flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-4">
                                    <div className="h-16 w-16 rounded-sm bg-muted/50 flex items-center justify-center">
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
                                <div className="divide-y pb-2">
                                    {selectedItems.map((item, index) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-2 px-6 py-3 items-center group hover:bg-primary/5 transition-colors">
                                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-sm bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden border">
                                                    {item.product.image ? (
                                                        <img src={resolveMediaUrl(item.product.image) ?? undefined} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <DynamicIcon
                                                            name={(typeof item.product.category === 'object' ? item.product.category?.icon : categories.find(c => c.id === item.product.category)?.icon) || "Package"}
                                                            className="h-4 w-4 text-muted-foreground/20"
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate leading-none mb-1">{item.product.name}</p>
                                                    <p className="text-[9px] text-muted-foreground uppercase font-medium">
                                                        {item.product.internal_code} • {formatCurrency(item.unit_cost)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={e => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                    className="h-7 px-1 text-center font-bold text-xs border-muted-foreground/20 focus-visible:ring-primary"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Select value={String(item.uom_id ?? '')} onValueChange={val => updateUom(item.id, parseInt(val))}>
                                                    <SelectTrigger className="h-7 text-[10px] border-muted-foreground/20 px-2 bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(item.product.available_uoms || []).map(uom => (
                                                            <SelectItem key={uom.id} value={String(uom.id)} className="text-[10px]">
                                                                 {uom.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2 flex items-center justify-end gap-2 pr-1">
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-primary">
                                                        {formatCurrency(item.subtotal)}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeItem(item.id)}
                                                    className="h-6 w-6 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Totals Section Align with POS */}
                        <div className="p-6 bg-muted/20 border-t space-y-4 shrink-0">
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
