"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X, AlertCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import api from "@/lib/api"
import { CategoryForm } from "./CategoryForm"

const productSchema = z.object({
    code: z.string().min(1, "El código es requerido"),
    name: z.string().min(1, "El nombre es requerido"),
    category: z.string().min(1, "La categoría es requerida"),
    product_type: z.enum(["STORABLE", "CONSUMABLE", "SERVICE", "MANUFACTURABLE"]),
    sale_price: z.string().min(0),
    sync_variants_price: z.boolean().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ProductForm({ onSuccess, initialData, open: openProp, onOpenChange }: ProductFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)

    // Variants State
    const [hasVariants, setHasVariants] = useState(false)
    const [variantAttributes, setVariantAttributes] = useState<{ name: string, values: string[] }[]>([])
    const [currentAttrName, setCurrentAttrName] = useState("")
    const [currentAttrValues, setCurrentAttrValues] = useState("")

    const fetchCategories = async () => {
        try {
            const response = await api.get('/inventory/categories/')
            setCategories(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch categories", error)
        }
    }

    useEffect(() => {
        if (open) fetchCategories()
    }, [open])

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: initialData ? {
            ...initialData,
            category: initialData.category?.toString() || "",
        } : {
            code: "",
            name: "",
            product_type: "STORABLE",
            sale_price: "0",
            sync_variants_price: false,
        },
    })

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    category: initialData.category?.id?.toString() || initialData.category?.toString() || "",
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    product_type: "STORABLE",
                    sale_price: "0",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: ProductFormValues) {
        setLoading(true)
        try {
            let productId
            if (initialData) {
                await api.put(`/inventory/products/${initialData.id}/`, data)
                productId = initialData.id
            } else {
                const res = await api.post('/inventory/products/', data)
                productId = res.data.id
            }

            // Generate Variants if new product and hasVariants
            if (!initialData && hasVariants && variantAttributes.length > 0) {
                const attributesPayload: any = {}
                variantAttributes.forEach(attr => {
                    attributesPayload[attr.name] = attr.values
                })

                try {
                    await api.post(`/inventory/products/${productId}/generate_variants/`, {
                        attributes: attributesPayload
                    })
                    toast.success("Variantes generadas exitosamente")
                } catch (error: any) {
                    console.error("Error generating variants:", error)
                    toast.error("Producto creado, pero error al generar variantes")
                }
            } else {
                toast.success(initialData ? "Producto actualizado" : "Producto creado exitosamente")
            }

            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving product:", error)
            toast.error(error.response?.data?.detail || "Error al guardar el producto")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nuevo Producto</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Producto" : "Crear Producto"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos del producto." : "Ingrese los datos del nuevo producto."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código/SKU</FormLabel>
                                    <FormControl>
                                        <Input placeholder="PROD-001" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Papel A4" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <div className="flex gap-2">
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue placeholder="Seleccione categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.filter(cat => cat.id).map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                                        {cat.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setIsCategoryFormOpen(true)}
                                            title="Nueva Categoría"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CategoryForm
                                        open={isCategoryFormOpen}
                                        onOpenChange={setIsCategoryFormOpen}
                                        onSuccess={fetchCategories}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="product_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="STORABLE">Almacenable</SelectItem>
                                            <SelectItem value="CONSUMABLE">Consumible</SelectItem>
                                            <SelectItem value="SERVICE">Servicio</SelectItem>
                                            <SelectItem value="MANUFACTURABLE">Fabricable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1">
                            <FormField
                                control={form.control}
                                name="sale_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Precio Venta</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="1"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0).toString())}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {initialData && initialData.variants_count > 0 && (
                                <FormField
                                    control={form.control}
                                    name="sync_variants_price"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs">Sincronizar precio con variantes</FormLabel>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Actualizará el precio de todas sus variantes al guardar.
                                                </div>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        {!initialData && (
                            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="has-variants"
                                        checked={hasVariants}
                                        onCheckedChange={setHasVariants}
                                    />
                                    <Label htmlFor="has-variants">Este producto tiene variantes</Label>
                                </div>

                                {hasVariants && (
                                    <div className="space-y-4 animate-in fade-in zoom-in slide-in-from-top-2 duration-300">
                                        <div className="text-sm text-muted-foreground">
                                            Defina los atributos (ej. Color) y sus valores separados por comba (ej. Rojo, Azul).
                                        </div>

                                        <div className="grid grid-cols-[1fr,1.5fr,auto] gap-2 items-end">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Atributo</Label>
                                                <Input
                                                    placeholder="Ej. Color"
                                                    value={currentAttrName}
                                                    onChange={(e) => setCurrentAttrName(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Valores (separar con coma)</Label>
                                                <Input
                                                    placeholder="Ej. Rojo, Azul, Verde"
                                                    value={currentAttrValues}
                                                    onChange={(e) => setCurrentAttrValues(e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon"
                                                onClick={() => {
                                                    if (!currentAttrName || !currentAttrValues) return
                                                    const values = currentAttrValues.split(',').map(v => v.trim()).filter(v => v)
                                                    if (values.length === 0) return

                                                    setVariantAttributes([...variantAttributes, { name: currentAttrName, values }])
                                                    setCurrentAttrName("")
                                                    setCurrentAttrValues("")
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            {variantAttributes.map((attr, idx) => (
                                                <div key={idx} className="flex items-start justify-between bg-background border p-2 rounded-md">
                                                    <div>
                                                        <span className="font-semibold text-sm">{attr.name}:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {attr.values.map((v, i) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">
                                                                    {v}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            const newAttrs = [...variantAttributes]
                                                            newAttrs.splice(idx, 1)
                                                            setVariantAttributes(newAttrs)
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Producto"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
