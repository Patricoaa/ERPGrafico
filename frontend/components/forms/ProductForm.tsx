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
    uom: z.string().min(1, "La unidad de medida es requerida"),
    purchase_uom: z.string().optional(),
    sale_price: z.string().min(0),
    sync_variants_price: z.boolean().optional(),
    image: z.any().optional(),
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
    const [uoms, setUoMs] = useState<any[]>([])
    const [imagePreview, setImagePreview] = useState<string | null>(null)
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

    const fetchUoMs = async () => {
        try {
            const response = await api.get('/inventory/uoms/')
            setUoMs(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch UoMs", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchCategories()
            fetchUoMs()
        }
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
            uom: "",
            purchase_uom: "",
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
                    uom: initialData.uom?.toString() || "",
                    purchase_uom: initialData.purchase_uom?.toString() || "",
                })
                if (initialData.image) {
                    setImagePreview(initialData.image)
                } else {
                    setImagePreview(null)
                }
            } else {
                form.reset({
                    code: "",
                    name: "",
                    product_type: "STORABLE",
                    uom: "",
                    purchase_uom: "",
                    sale_price: "0",
                })
                setImagePreview(null)
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: ProductFormValues) {
        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('code', data.code)
            formData.append('name', data.name)
            formData.append('category', data.category)
            formData.append('product_type', data.product_type)
            formData.append('sale_price', data.sale_price)
            // Assuming description might be added later or is implicitly handled
            // if (data.description) formData.append('description', data.description) 
            if (data.uom && data.uom !== "none") formData.append('uom', data.uom)
            if (data.purchase_uom && data.purchase_uom !== "none") formData.append('purchase_uom', data.purchase_uom)

            if (data.image && data.image instanceof File) {
                formData.append('image', data.image)
            } else if (data.image === null) {
                // If image was explicitly set to null (e.g., removed by user)
                formData.append('image', '') // Send empty string to clear image on backend
            }


            let productId: number
            if (initialData) {
                const res = await api.put(`/inventory/products/${initialData.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                productId = res.data.id
            } else {
                const res = await api.post('/inventory/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
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
            <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto">
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
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Imagen del Producto</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-col gap-2">
                                            {imagePreview && (
                                                <div className="relative w-32 h-32 border rounded overflow-hidden">
                                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-0 right-0 h-6 w-6"
                                                        onClick={() => {
                                                            setImagePreview(null)
                                                            field.onChange(null)
                                                        }}
                                                    >
                                                        X
                                                    </Button>
                                                </div>
                                            )}
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        field.onChange(file)
                                                        const reader = new FileReader()
                                                        reader.onloadend = () => {
                                                            setImagePreview(reader.result as string)
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        </div>
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
                        {["STORABLE", "MANUFACTURABLE"].includes(form.watch("product_type")) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="uom"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unidad de Medida (Stock)</FormLabel>
                                            <Select onValueChange={(val) => {
                                                field.onChange(val)
                                                // Reset purchase UoM when stock uom category changes
                                                // logic handled by effect or manual check here
                                                const newStockUoM = uoms.find(u => u.id.toString() === val)
                                                const currentPurchaseUoM = uoms.find(u => u.id.toString() === form.getValues("purchase_uom"))

                                                if (newStockUoM && currentPurchaseUoM && newStockUoM.category !== currentPurchaseUoM.category) {
                                                    form.setValue("purchase_uom", "")
                                                }
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Ej. Unidades, kg" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {uoms.map((u) => (
                                                        <SelectItem key={u.id} value={u.id.toString()}>
                                                            {u.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="purchase_uom"
                                    render={({ field }) => {
                                        const stockUoMId = form.watch("uom")
                                        const stockUoM = uoms.find(u => u.id.toString() === stockUoMId)
                                        // Filter: Only Allow UoMs of same category. If no stock uom selected, allow all? or none?
                                        // Usually require stock uom first.
                                        const validUoMs = stockUoM
                                            ? uoms.filter(u => u.category === stockUoM.category)
                                            : uoms

                                        return (
                                            <FormItem>
                                                <FormLabel>Unidad de Compra</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!stockUoMId}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={stockUoMId ? "Ej. Cajas, Pallets" : "Seleccione Unidad Stock primero"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {validUoMs.map((u) => (
                                                            <SelectItem key={u.id} value={u.id.toString()}>
                                                                {u.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="sale_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Precio Venta Neto</FormLabel>
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
                            {/* Computed VAT and Total */}
                            <div className="flex gap-2">
                                <FormItem className="flex-1">
                                    <FormLabel>IVA (19%)</FormLabel>
                                    <Input
                                        readOnly
                                        disabled
                                        value={Math.round((parseInt(form.watch("sale_price") || "0") * 0.19)).toString()}
                                        className="bg-muted"
                                    />
                                </FormItem>
                                <FormItem className="flex-1">
                                    <FormLabel>Total</FormLabel>
                                    <Input
                                        readOnly
                                        disabled
                                        value={Math.round((parseInt(form.watch("sale_price") || "0") * 1.19)).toString()}
                                        className="bg-muted font-bold text-indigo-700"
                                    />
                                </FormItem>
                            </div>
                        </div>

                        {initialData && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                                <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Costo Actual (Neto)</Label>
                                <div className="text-xl font-bold text-blue-900 mt-1">
                                    ${parseFloat(initialData.cost_price || "0").toLocaleString('es-CL')}
                                </div>
                            </div>
                        )}

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
        </Dialog >
    )
}
