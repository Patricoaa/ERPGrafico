"use client"

import { Button } from "@/components/ui/button"
import React, { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Trash2, Calculator, Info, Minus, Plus, Package } from "lucide-react"
import {
    Drawer, StepHeader, SummaryActions, SummaryLine, SummaryLineList, SummaryMenu,
    SummaryPanel, SummaryPanelHeader, SummaryTotal,
} from '@/components/shared'
import { ProductGridPicker } from "@/components/selectors"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"

import type { BaseProduct, ProductCategory } from "@/features/inventory"
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
    available_uoms?: Array<{ id: number; name: string; ratio: number; abbreviation?: string }>
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

import { useVatRate } from '@/hooks/useVatRate'
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { useCategories } from "@/features/inventory/hooks/useCategories"
export function CostCalculatorDrawer({ open, onOpenChange }: CostCalculatorDrawerProps) {
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const idCounterRef = React.useRef(0)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

    const { rate, multiplier } = useVatRate()

    const { products: rawProducts = [], isLoading: loadingProducts } = useProducts({
        filters: {
            is_active: true,
            track_inventory: true,
            fields: 'id,name,cost_price,image,uom_name,internal_code,barcode,product_type,available_uoms,category,uom'
        }
    })
    const products = rawProducts as unknown as Product[]

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
            fillContent
            contentClassName="p-0 flex flex-col overflow-hidden"
        >
            <div className="flex-1 overflow-hidden flex">
                {/* Panel Izquierdo: Catálogo */}
                <div className="w-[60%] flex flex-col p-4 min-h-0">
                    <div className="surface-panel flex min-h-0 flex-1 flex-col gap-3 p-3">
                    <StepHeader
                        title="Selección de Productos"
                        description="Agregue los productos para estimar el costo de producción."
                        icon={Package}
                    />
                    {loading ? (
                        <Card className="flex-1 flex flex-col shadow-none border-0 bg-transparent py-0">
                            <div className="px-2 pt-1.5 pb-1.5 border-b">
                                <POSSearchSkeleton />
                            </div>
                            <div className="p-6">
                                <POSGridSkeleton count={8} />
                            </div>
                        </Card>
                    ) : (
                        <ProductGridPicker
                            products={filteredProducts as unknown as BaseProduct[]}
                            categories={categories as unknown as ProductCategory[]}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            selectedCategoryId={selectedCategoryId}
                            onSelectCategory={setSelectedCategoryId}
                            onProductClick={(p) => addItem(p as unknown as Product)}
                            priceRenderer={(product) => {
                                const p = product as unknown as Product
                                const primaryUom = p.available_uoms?.find(u => u.id === Number(p.uom))
                                const uomLabel = primaryUom?.abbreviation || p.uom_name || "UN"
                                return (
                                    <>
                                        <span className="text-lg font-semibold tabular-nums">
                                            {formatCurrency(p.cost_price || 0)}
                                        </span>
                                        <span className="text-2xs text-muted-foreground ml-1">
                                            / {uomLabel.toLowerCase()}
                                        </span>
                                    </>
                                )
                            }}
                            priceLabel="Costo"
                            transparent
                        />
                    )}
                    </div>
                </div>

                {/* Panel Derecho: Selección */}
                <div className="w-[45%] flex flex-col p-4 min-h-0">
                    <SummaryPanel>
                        <SummaryPanelHeader
                            title="Tu lista"
                            count={selectedItems.length}
                            menu={<SummaryMenu items={[{
                                id: 'clear',
                                label: 'Vaciar lista',
                                icon: Trash2,
                                destructive: true,
                                hidden: selectedItems.length === 0,
                                onSelect: () => setSelectedItems([]),
                            }]} />}
                        />

                        <SummaryLineList
                            isLoading={loading}
                            loading={<POSCartItemsSkeleton count={6} />}
                            isEmpty={selectedItems.length === 0}
                            empty={
                                <>
                                    <Calculator className="size-12 text-muted-foreground/30" aria-hidden />
                                    <div className="space-y-1">
                                        <p className="text-lg font-bold tracking-tight text-muted-foreground">Tu lista está vacía</p>
                                        <p className="mx-auto max-w-[260px] text-sm">Toca productos del catálogo para calcular costos.</p>
                                    </div>
                                </>
                            }
                        >
                            {selectedItems.map((item) => (
                                <SummaryLine
                                    key={item.id}
                                    name={item.product.name}
                                    total={formatCurrency(item.subtotal)}
                                    unit={<>{formatCurrency(item.unit_cost)} ×</>}
                                    stepper={
                                        <div className="flex h-control-lg items-center overflow-hidden rounded-sm border border-border bg-background">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="size-control-lg rounded-none border-none shadow-none disabled:opacity-30"
                                                aria-label="Disminuir cantidad"
                                                onClick={() => updateQuantity(item.id, Math.max(0.01, item.quantity - 1))}
                                                disabled={item.quantity <= 0.01}
                                            >
                                                <Minus className="size-4" aria-hidden />
                                            </Button>
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                step="any"
                                                min="0.01"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                                                aria-label="Cantidad"
                                                className="h-full w-16 rounded-none border-x border-y-0 border-border bg-transparent p-0 text-center font-mono text-base font-bold shadow-none focus-visible:ring-0"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="size-control-lg rounded-none border-none shadow-none"
                                                aria-label="Aumentar cantidad"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            >
                                                <Plus className="size-4" aria-hidden />
                                            </Button>
                                        </div>
                                    }
                                    uom={
                                        <Select value={String(item.uom_id ?? '')} onValueChange={val => updateUom(item.id, parseInt(val))}>
                                            <SelectTrigger className="h-control-lg w-auto min-w-24 gap-1 rounded-sm px-3 text-sm font-semibold text-foreground" aria-label="Unidad de medida">
                                                <SelectValue placeholder="Unidad" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(item.product.available_uoms || []).map(uom => (
                                                    <SelectItem key={uom.id} value={String(uom.id)} className="min-h-control-touch text-base">
                                                        {uom.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    }
                                    actions={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="size-control-lg rounded-sm text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => removeItem(item.id)}
                                            aria-label={`Quitar ${item.product.name}`}
                                        >
                                            <Trash2 className="size-4" aria-hidden />
                                        </Button>
                                    }
                                />
                            ))}
                        </SummaryLineList>

                        <SummaryTotal
                            label="Costo total"
                            total={formatCurrency(Math.round(totalCost * multiplier))}
                            breakdown={[
                                { label: 'Costo neto', value: formatCurrency(totalCost) },
                                { label: `IVA estimado ${rate}%`, value: formatCurrency(Math.round(totalCost * (rate / 100))) },
                            ]}
                            note={<><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Simulación con precio de costo. No mueve stock ni genera registros.</>}
                        />

                        <SummaryActions>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-control-touch gap-2 rounded-sm text-base font-black"
                                disabled={selectedItems.length === 0}
                                onClick={() => setSelectedItems([])}
                            >
                                <Trash2 className="size-5" aria-hidden />
                                Vaciar lista
                            </Button>
                        </SummaryActions>
                    </SummaryPanel>
                </div>
            </div>
        </Drawer>
    )
}
