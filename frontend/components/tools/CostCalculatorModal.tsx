"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Loader2, Calculator } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

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
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        if (open) {
            fetchProducts()
        }
    }, [open])

    const fetchProducts = async () => {
        setLoading(true)
        try {
            const res = await api.get('/inventory/products/', {
                params: {
                    active: true,
                    exclude_variant_templates: true,
                    show_technical_variants: true // Show variants since they are what actually has stock
                }
            })
            const data = res.data.results || res.data
            setProducts(data)
        } catch (error) {
            toast.error("Error al cargar productos")
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

        const isStorable = p.product_type === 'STORABLE'
        const isSimple = !p.requires_advanced_manufacturing

        // Final criteria based on user request: 
        // "solo deberia mostrar productos fabricable de tipo simple (osea que son almacenables ) y productos almacenables"
        return matchesSearch && isStorable && isSimple
    })

    const handleClose = () => {
        setSelectedItems([])
        setSearchTerm("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent size="full" className="flex flex-col p-0 overflow-hidden">
                <div className="p-6 border-b bg-muted/30">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-black flex items-center gap-2">
                                    <Calculator className="h-6 w-6 text-primary" />
                                    Calculadora de Costos
                                </DialogTitle>
                                <DialogDescription className="text-base">
                                    Simulación rápida de materiales para determinar costos de producción
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-hidden flex divide-x">
                    {/* Panel Izquierdo: Catálogo */}
                    <div className="w-[45%] flex flex-col p-6 gap-4 bg-background">
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Buscar por nombre, código o código de barras..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="flex-1 h-12 text-lg shadow-sm"
                            />
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            {loading && products.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-muted-foreground">
                                    <Loader2 className="h-10 w-10 animate-spin" />
                                    <p>Cargando productos...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                                    {filteredProducts.map(product => (
                                        <Card
                                            key={product.id}
                                            className="group cursor-pointer hover:border-primary/50 transition-all shadow-sm hover:shadow-md border-muted-foreground/10 overflow-hidden flex flex-col"
                                            onClick={() => addItem(product)}
                                        >
                                            <div className="aspect-square bg-muted relative overflow-hidden flex items-center justify-center">
                                                {product.image ? (
                                                    <img
                                                        src={product.image}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                ) : (
                                                    <Plus className="h-12 w-12 text-muted-foreground/30" />
                                                )}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Badge className="bg-primary text-primary-foreground shadow-lg">
                                                        <Plus className="h-3 w-3 mr-1" /> Agregar
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardContent className="p-3 flex-1 flex flex-col justify-between gap-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-tighter mb-1">
                                                        {product.internal_code}
                                                    </p>
                                                    <p className="text-sm font-bold leading-tight line-clamp-2">
                                                        {product.name}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-xs text-muted-foreground uppercase">
                                                        {product.uom_name}
                                                    </span>
                                                    <span className="text-base font-black text-primary">
                                                        ${new Intl.NumberFormat("es-CL").format(product.cost_price || 0)}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-muted-foreground">
                                            No se encontraron productos.
                                        </div>
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Panel Derecho: Selección */}
                    <div className="w-[55%] flex flex-col p-6 bg-muted/5 gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black uppercase tracking-tight">
                                Materiales Seleccionados
                                <Badge variant="secondary" className="ml-2 bg-muted-foreground/10 text-muted-foreground">
                                    {selectedItems.length}
                                </Badge>
                            </h3>
                            {selectedItems.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="text-muted-foreground hover:text-destructive">
                                    Limpiar Todo
                                </Button>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden bg-background rounded-xl border shadow-sm">
                            <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-muted/50 border-b text-xs font-bold uppercase text-muted-foreground tracking-widest">
                                <div className="col-span-5">Descripción</div>
                                <div className="col-span-2 text-center px-1">Cantidad</div>
                                <div className="col-span-3">UoM</div>
                                <div className="col-span-2 text-right">Subtotal</div>
                            </div>

                            <ScrollArea className="flex-1">
                                {selectedItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-4">
                                        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                                            <Calculator className="h-10 w-10 text-muted-foreground/30" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-lg">Tu lista está vacía</p>
                                            <p className="max-w-[240px] text-sm italic">
                                                Haz click en los productos de la izquierda para agregarlos al cálculo de costos.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {selectedItems.map(item => (
                                            <div key={item.id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center group hover:bg-muted/30 transition-colors">
                                                <div className="col-span-5 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden border">
                                                        {item.product.image ? (
                                                            <img src={item.product.image} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Plus className="h-5 w-5 text-muted-foreground/30" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate">{item.product.name}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                                            {item.product.internal_code} • ${new Intl.NumberFormat("es-CL").format(item.unit_cost)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 px-1">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.quantity}
                                                        onChange={e => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                        className="h-8 px-1 text-center font-bold focus:ring-primary border-muted-foreground/20"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <Select value={String(item.uom_id ?? '')} onValueChange={val => updateUom(item.id, parseInt(val))}>
                                                        <SelectTrigger className="h-8 text-[11px] border-muted-foreground/20 px-2">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(item.product.available_uoms || []).map(uom => (
                                                                <SelectItem key={uom.id} value={String(uom.id)} className="text-[11px]">
                                                                    {uom.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-2 flex items-center justify-end gap-2 pl-1">
                                                    <p className="text-xs font-black text-right min-w-[60px]">
                                                        ${new Intl.NumberFormat("es-CL").format(item.subtotal)}
                                                    </p>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeItem(item.id)}
                                                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Sumatoria Total */}
                            <div className="p-4 bg-blue-50/50 border-t mt-auto">
                                <div className="space-y-2">
                                    {/* Primary Focus: Total Neto (Blue) */}
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Costo de Producción</span>
                                            <span className="text-sm font-black text-blue-600 tracking-widest uppercase">Total Neto</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-600 tracking-widest leading-none">
                                            ${new Intl.NumberFormat("es-CL").format(Math.round(totalCost))}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-muted-foreground/80">
                                        <span className="text-sm font-bold uppercase tracking-widest">IVA (19%)</span>
                                        <span className="text-base font-bold">
                                            + ${new Intl.NumberFormat("es-CL").format(Math.round(totalCost * 0.19))}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-muted-foreground/80">
                                        <span className="text-sm font-bold uppercase tracking-widest">Total Bruto (Con IVA)</span>
                                        <span className="text-sm font-bold">
                                            ${new Intl.NumberFormat("es-CL").format(Math.round(totalCost * 1.19))}
                                        </span>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
