"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface Product {
    id: number
    name: string
    internal_code: string
    image?: string
    cost: number
    uom?: { id: number; name: string }
    available_uoms?: Array<{ id: number; name: string; ratio: number }>
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
                    type__in: 'STORABLE,CONSUMABLE',
                    active: true
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

        const uom = product.uom || product.available_uoms?.[0]
        if (!uom) {
            toast.error("Producto sin unidad de medida configurada")
            return
        }

        const newItem: SelectedItem = {
            id: `${product.id}-${Date.now()}`,
            product,
            quantity: 1,
            uom_id: uom.id,
            uom_name: uom.name,
            unit_cost: product.cost || 0,
            subtotal: product.cost || 0
        }

        setSelectedItems([...selectedItems, newItem])
    }

    const removeItem = (itemId: string) => {
        setSelectedItems(selectedItems.filter(item => item.id !== itemId))
    }

    const updateQuantity = (itemId: string, quantity: number) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.id === itemId) {
                const newQuantity = Math.max(0, quantity)
                return {
                    ...item,
                    quantity: newQuantity,
                    subtotal: newQuantity * item.unit_cost
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

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.internal_code?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleClose = () => {
        setSelectedItems([])
        setSearchTerm("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Calculadora de Costos de Materiales</DialogTitle>
                    <DialogDescription>
                        Selecciona productos para calcular el costo total de materiales
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 h-[70vh]">
                    {/* Left: Product Grid */}
                    <div className="flex flex-col gap-3">
                        <Input
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <ScrollArea className="flex-1 border rounded-lg p-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {filteredProducts.map(product => (
                                        <Card
                                            key={product.id}
                                            className="cursor-pointer hover:bg-accent transition-colors"
                                            onClick={() => addItem(product)}
                                        >
                                            <CardContent className="p-3">
                                                <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Plus className="h-8 w-8 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium line-clamp-2 mb-1">
                                                    {product.name}
                                                </p>
                                                <Badge variant="secondary" className="text-xs">
                                                    ${new Intl.NumberFormat("es-CL").format(product.cost || 0)}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right: Selected Items */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold">Materiales Seleccionados ({selectedItems.length})</h3>
                        <ScrollArea className="flex-1 border rounded-lg">
                            {selectedItems.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground italic">
                                    No has seleccionado ningún material
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {selectedItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-3 p-3">
                                            <div className="w-12 h-12 bg-muted rounded flex-shrink-0 overflow-hidden">
                                                {item.product.image ? (
                                                    <img
                                                        src={item.product.image}
                                                        alt={item.product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Plus className="h-6 w-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{item.product.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ${new Intl.NumberFormat("es-CL").format(item.unit_cost)} / {item.uom_name}
                                                </p>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={item.quantity}
                                                onChange={e => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                className="w-20 text-right"
                                            />
                                            {item.product.available_uoms && item.product.available_uoms.length > 1 ? (
                                                <Select value={item.uom_id.toString()} onValueChange={val => updateUom(item.id, parseInt(val))}>
                                                    <SelectTrigger className="w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {item.product.available_uoms.map(uom => (
                                                            <SelectItem key={uom.id} value={uom.id.toString()}>
                                                                {uom.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="w-24 text-sm text-center">{item.uom_name}</span>
                                            )}
                                            <p className="text-sm font-bold w-24 text-right">
                                                ${new Intl.NumberFormat("es-CL").format(item.subtotal)}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Total */}
                        <div className="bg-primary/5 p-4 border-2 border-primary rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">COSTO TOTAL</span>
                                <span className="text-2xl font-black text-primary">
                                    ${new Intl.NumberFormat("es-CL").format(totalCost)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleClose}>
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
