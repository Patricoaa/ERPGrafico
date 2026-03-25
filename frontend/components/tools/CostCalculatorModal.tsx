"use client"

import React, { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Loader2, Calculator, Info, Package } from "lucide-react"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { SearchBar } from "@/app/(dashboard)/sales/pos/components/SearchBar"
import { CategoryFilter } from "@/app/(dashboard)/sales/pos/components/CategoryFilter"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

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

interface Category {
    id: number
    name: string
    icon?: string | null
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

interface CostCalculatorModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CostCalculatorModal({ open, onOpenChange }: CostCalculatorModalProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

    useEffect(() => {
        if (open) {
            fetchInitialData()
        }
    }, [open])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [productsRes, categoriesRes] = await Promise.all([
                api.get('/inventory/products/', {
                    params: {
                        active: true,
                        exclude_variant_templates: true,
                        show_technical_variants: true
                    }
                }),
                api.get('/inventory/categories/?page_size=9999')
            ])
            setProducts(productsRes.data.results || productsRes.data)
            setCategories(categoriesRes.data.results || categoriesRes.data)
        } catch (error) {
            toast.error("Error al cargar datos")
        } finally {
            setLoading(false)
        }
    }

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

        const newItem: SelectedItem = {
            id: `${product.id}-${Date.now()}`,
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
        <BaseModal
            open={open}
            onOpenChange={handleClose}
            size="full"
            hideScrollArea
            title={
                <div className="flex items-center justify-between w-full pr-12">
                    <div className="flex items-center gap-2">
                        <Calculator className="h-6 w-6 text-blue-600" />
                        <span>Calculadora de Costos</span>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 px-3 py-1 animate-pulse">
                        <Info className="h-3 w-3" />
                        Modo Simulación
                    </Badge>
                </div>
            }
            description="Simulación rápida de materiales para determinar costos de producción (No afecta stock)"
        >
            <div className="flex-1 overflow-hidden flex divide-x h-[calc(100vh-220px)] max-h-[750px]">
                {/* Panel Izquierdo: Catálogo */}
                <div className="w-[60%] flex flex-col p-4 gap-4 bg-muted/20 min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden shadow-none border bg-background">
                        <div className="p-4 border-b bg-background/50 space-y-3">
                            <SearchBar 
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar por nombre, código o código de barras..."
                                autoFocus={false}
                            />

                            <CategoryFilter 
                                categories={categories}
                                selectedCategoryId={selectedCategoryId}
                                onSelectCategory={setSelectedCategoryId}
                            />
                        </div>

                        <ScrollArea className="flex-1">
                            <CardContent className="p-6">
                                {loading && products.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-muted-foreground">
                                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                        <p>Cargando productos...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {filteredProducts.map(product => (
                                            <Card
                                                key={product.id}
                                                className="group cursor-pointer hover:border-blue-500/50 transition-all active:scale-95 relative flex flex-col overflow-hidden shadow-sm"
                                                onClick={() => addItem(product)}
                                            >
                                                <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                        />
                                                    ) : (
                                                        <DynamicIcon 
                                                            name={(typeof product.category === 'object' ? product.category?.icon : categories.find(c => c.id === product.category)?.icon) || "Package"} 
                                                            className="h-12 w-12 text-muted-foreground/20 group-hover:scale-110 transition-transform" 
                                                        />
                                                    )}
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        <Badge className="bg-blue-600 text-white shadow-lg border-none">
                                                            <Plus className="h-3 w-3 mr-1" /> Agregar
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <CardContent className="p-3 text-center flex-1 flex flex-col justify-center gap-1.5">
                                                    <div className="flex justify-center gap-1">
                                                        {product.internal_code && (
                                                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-mono uppercase opacity-70 border-muted-foreground/30">
                                                                {product.internal_code}
                                                            </Badge>
                                                        )}
                                                        {product.code && product.code !== product.internal_code && (
                                                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-mono uppercase opacity-70">
                                                                {product.code}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-bold leading-tight line-clamp-2">
                                                        {product.name}
                                                    </p>
                                                    <div className="mt-0.5">
                                                        <span className="text-base font-black text-blue-600">
                                                            {formatCurrency(product.cost_price || 0)}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground ml-1 uppercase">
                                                            /{product.uom_name}
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <div className="col-span-full py-12 text-center text-muted-foreground italic">
                                                No se encontraron productos.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Panel Derecho: Selección */}
                <div className="w-[40%] flex flex-col p-4 bg-muted/10 gap-4 min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-none border bg-background">
                        {/* List Header */}
                        <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-muted/20 border-b text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest shrink-0">
                            <div className="col-span-6">Descripción</div>
                            <div className="col-span-2 text-center">Cant.</div>
                            <div className="col-span-2">Unidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                        </div>

                        <ScrollArea className="flex-1">
                            {selectedItems.length === 0 ? (
                                <div className="h-[300px] flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-4">
                                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
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
                                        <div key={item.id} className="grid grid-cols-12 gap-2 px-6 py-3 items-center group hover:bg-blue-50/30 transition-colors">
                                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden border">
                                                    {item.product.image ? (
                                                        <img src={item.product.image} className="w-full h-full object-cover" />
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
                                                    className="h-7 px-1 text-center font-bold text-xs border-muted-foreground/20 focus-visible:ring-blue-500"
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
                                                    <p className="text-xs font-black text-blue-700">
                                                        {formatCurrency(item.subtotal)}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeItem(item.id)}
                                                    className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
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

                                        <span className="text-lg font-black text-blue-700 uppercase tracking-tighter">
                                            Total
                                        </span>
                                    </div>
                                    <span className="text-3xl font-black text-blue-700 tracking-tighter">
                                        {formatCurrency(Math.round(totalCost * 1.19))}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-blue-600/5 border border-blue-600/10 rounded-lg p-3 flex items-start gap-3">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-blue-700/80 leading-relaxed font-medium uppercase tracking-tight">
                                    Esta es una simulación de costos de producción basada en el precio de costo de los materiales seleccionados. No afecta movimientos de stock ni genera registros comerciales.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </BaseModal>
    )
}
