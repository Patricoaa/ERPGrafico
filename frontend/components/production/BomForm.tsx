"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, X } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ProductSelector } from "../selectors/ProductSelector"

interface BomLine {
    id?: number
    component: number
    component_name?: string
    quantity: number
    unit: string
    sequence: number
}

interface Product {
    id: number
    name: string
    code: string
}

interface BomFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialData?: any
}

export function BomForm({ open, onOpenChange, onSuccess, initialData }: BomFormProps) {
    const [name, setName] = useState("")
    const [product, setProduct] = useState<number | null>(null)
    const [active, setActive] = useState(true)
    const [lines, setLines] = useState<BomLine[]>([])
    const [loading, setLoading] = useState(false)
    const [manufacturableProducts, setManufacturableProducts] = useState<Product[]>([])

    useEffect(() => {
        if (open) {
            fetchManufacturableProducts()
            if (initialData) {
                setName(initialData.name)
                setProduct(initialData.product)
                setActive(initialData.active)
                setLines(initialData.lines || [])
            } else {
                resetForm()
            }
        }
    }, [open, initialData])

    const fetchManufacturableProducts = async () => {
        try {
            // Need an endpoint to filter by type=MANUFACTURABLE
            // Assuming API supports ?product_type=MANUFACTURABLE
            const response = await api.get('/inventory/products/?product_type=MANUFACTURABLE')
            setManufacturableProducts(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching products:", error)
        }
    }

    const resetForm = () => {
        setName("")
        setProduct(null)
        setActive(true)
        setLines([])
    }

    const handleAddLine = () => {
        setLines([...lines, {
            component: 0,
            quantity: 1,
            unit: 'UN',
            sequence: lines.length + 1
        }])
    }

    const handleRemoveLine = (index: number) => {
        const newLines = lines.filter((_, i) => i !== index)
        setLines(newLines.map((line, i) => ({ ...line, sequence: i + 1 })))
    }

    const handleLineChange = (index: number, field: keyof BomLine, value: any) => {
        const newLines = [...lines]
        newLines[index] = { ...newLines[index], [field]: value }
        setLines(newLines)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!product) {
            toast.error("Seleccione un producto a fabricar")
            return
        }
        if (lines.length === 0) {
            toast.error("Agregue al menos un componente")
            return
        }

        const validLines = lines.every(l => l.component && l.quantity > 0)
        if (!validLines) {
            toast.error("Complete todos los campos de los componentes")
            return
        }

        setLoading(true)
        try {
            const payload = {
                name,
                product,
                active,
                lines: lines.map(l => ({
                    component: l.component,
                    quantity: l.quantity,
                    unit: l.unit,
                    sequence: l.sequence
                }))
            }

            if (initialData) {
                await api.put(`/production/boms/${initialData.id}/`, payload)
                toast.success("Lista de Materiales actualizada")
            } else {
                await api.post('/production/boms/', payload)
                toast.success("Lista de Materiales creada")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error submiting BOM:", error)
            toast.error(error.response?.data?.error || "Error al guardar BOM")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? 'Editar Lista de Materiales' : 'Nueva Lista de Materiales'}
                    </DialogTitle>
                    <DialogDescription>
                        Define los componentes necesarios para fabricar un producto.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="product">Producto a Fabricar</Label>
                            <Select
                                value={product?.toString()}
                                onValueChange={(v) => setProduct(Number(v))}
                                disabled={!!initialData}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar producto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {manufacturableProducts.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name} ({p.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre / Versión</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ej. Mesa V1"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="active"
                            checked={active}
                            onCheckedChange={setActive}
                        />
                        <Label htmlFor="active">Activo</Label>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Componentes</h3>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                                <Plus className="h-4 w-4 mr-2" /> Agregar Componente
                            </Button>
                        </div>

                        <div className="rounded-md border p-4 space-y-4">
                            {lines.length === 0 && (
                                <p className="text-sm text-center text-muted-foreground py-4">
                                    No hay componentes agregados.
                                </p>
                            )}

                            {lines.map((line, index) => (
                                <div key={index} className="flex items-end gap-3 p-3 border rounded-md bg-muted/20 relative group">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Componente</Label>
                                        <ProductSelector
                                            value={line.component}
                                            onChange={(val: string | null) => handleLineChange(index, 'component', Number(val))}
                                        />
                                    </div>
                                    <div className="w-24 space-y-1">
                                        <Label className="text-xs">Cantidad</Label>
                                        <Input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={line.quantity}
                                            onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="w-24 space-y-1">
                                        <Label className="text-xs">Unidad</Label>
                                        <Select
                                            value={line.unit}
                                            onValueChange={(v) => handleLineChange(index, 'unit', v)}
                                        >
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="UN">UN</SelectItem>
                                                <SelectItem value="KG">KG</SelectItem>
                                                <SelectItem value="M">M</SelectItem>
                                                <SelectItem value="L">L</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mb-[2px] text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRemoveLine(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Lista"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
