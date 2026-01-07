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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PricingRuleForm } from "./PricingRuleForm"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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

    // Pricing Rules State
    const [specificRules, setSpecificRules] = useState<any[]>([])
    const [categoryRules, setCategoryRules] = useState<any[]>([])
    const [isPricingRuleFormOpen, setIsPricingRuleFormOpen] = useState(false)

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

    const fetchPricingRules = async () => {
        if (!open) return
        try {
            const categoryId = form.watch("category")
            if (categoryId) {
                const res = await api.get(`/inventory/pricing-rules/?category=${categoryId}`)
                setCategoryRules(res.data.results || res.data)
            }
            if (initialData) {
                const res = await api.get(`/inventory/pricing-rules/?product=${initialData.id}`)
                setSpecificRules(res.data.results || res.data)
            }
        } catch (error) {
            console.error("Error fetching pricing rules", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchCategories()
            fetchUoMs()
            fetchPricingRules()
        }
    }, [open])

    useEffect(() => {
        if (open) {
            fetchPricingRules()
        }
    }, [form.watch("category")])

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
            <DialogContent className="sm:max-w-[1240px] w-[98vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Producto" : "Crear Producto"}</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="general">Información General</TabsTrigger>
                        <TabsTrigger value="variants">Variantes</TabsTrigger>
                        <TabsTrigger value="pricing">Regla de Precios</TabsTrigger>
                    </TabsList>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <TabsContent value="general" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 border p-4 rounded-lg bg-muted/5">
                                    {/* Column 1: Tipo */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="product_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold">Tipo de Producto</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                            className="flex flex-col space-y-2 mt-2"
                                                        >
                                                            <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                                                <RadioGroupItem value="STORABLE" id="rt-storable" />
                                                                <Label htmlFor="rt-storable" className="flex-1 cursor-pointer">Almacenable</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                                                <RadioGroupItem value="SERVICE" id="rt-service" />
                                                                <Label htmlFor="rt-service" className="flex-1 cursor-pointer">Servicio</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                                                <RadioGroupItem value="CONSUMABLE" id="rt-consumable" />
                                                                <Label htmlFor="rt-consumable" className="flex-1 cursor-pointer">Consumible</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                                                                <RadioGroupItem value="MANUFACTURABLE" id="rt-manuf" />
                                                                <Label htmlFor="rt-manuf" className="flex-1 cursor-pointer">Fabricable</Label>
                                                            </div>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Column 2: Nombre | Categoria */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nombre</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Papel A4" {...field} />
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
                                                    <div className="flex gap-1">
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="flex-1">
                                                                    <SelectValue placeholder="Categoría" />
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
                                                            className="h-9 w-9 shrink-0"
                                                            onClick={() => setIsCategoryFormOpen(true)}
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
                                    </div>

                                    {/* Column 3: Código | Imagen */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Código / SKU</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="SKU-001" {...field} />
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
                                                    <FormLabel>Imagen</FormLabel>
                                                    <FormControl>
                                                        <div className="flex flex-col gap-2">
                                                            {imagePreview ? (
                                                                <div className="relative w-full aspect-video border rounded-md overflow-hidden bg-muted/20">
                                                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="absolute top-1 right-1 h-6 w-6"
                                                                        onClick={() => {
                                                                            setImagePreview(null)
                                                                            field.onChange(null)
                                                                        }}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <Input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="text-xs h-auto py-1"
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
                                                            )}
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Column 4: UoM */}
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="uom"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Unidad de Medida</FormLabel>
                                                    <Select onValueChange={(val) => {
                                                        field.onChange(val)
                                                        const newStockUoM = uoms.find(u => u.id.toString() === val)
                                                        const currentPurchaseUoM = uoms.find(u => u.id.toString() === form.getValues("purchase_uom"))
                                                        if (newStockUoM && currentPurchaseUoM && newStockUoM.category !== currentPurchaseUoM.category) {
                                                            form.setValue("purchase_uom", "")
                                                        }
                                                    }} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Stock UoM" />
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
                                                const validUoMs = stockUoM ? uoms.filter(u => u.category === stockUoM.category) : uoms
                                                return (
                                                    <FormItem>
                                                        <FormLabel>Unidad de Compra</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={!stockUoMId}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Compra UoM" />
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

                                    {/* Column 5: Precios */}
                                    <div className="space-y-4">
                                        {initialData && (
                                            <div className="p-2 border rounded-md bg-blue-50/50">
                                                <Label className="text-[10px] text-blue-600 font-bold uppercase">Costo Actual</Label>
                                                <div className="text-lg font-bold text-blue-900">
                                                    ${parseFloat(initialData.cost_price || "0").toLocaleString('es-CL')}
                                                </div>
                                            </div>
                                        )}
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
                                                            {...field}
                                                            onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0).toString())}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">IVA (19%)</Label>
                                                <Input
                                                    readOnly
                                                    disabled
                                                    value={Math.round((parseInt(form.watch("sale_price") || "0") * 0.19)).toString()}
                                                    className="bg-muted h-8 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Total</Label>
                                                <Input
                                                    readOnly
                                                    disabled
                                                    value={Math.round((parseInt(form.watch("sale_price") || "0") * 1.19)).toString()}
                                                    className="bg-muted h-8 text-xs font-bold text-indigo-700"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="variants" className="mt-0">
                                <div className="space-y-4">
                                    {initialData && initialData.variants_count > 0 && (
                                        <FormField
                                            control={form.control}
                                            name="sync_variants_price"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mb-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-sm">Sincronizar precio con variantes</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    {!initialData ? (
                                        <div className="space-y-4 border rounded-md p-6 bg-muted/20">
                                            <div className="flex items-center space-x-2">
                                                <Switch id="has-variants" checked={hasVariants} onCheckedChange={setHasVariants} />
                                                <Label htmlFor="has-variants" className="text-lg font-medium">Este producto tiene variantes</Label>
                                            </div>

                                            {hasVariants && (
                                                <div className="space-y-6 pt-4 animate-in fade-in zoom-in slide-in-from-top-2 duration-300">
                                                    <div className="grid grid-cols-[1fr,1.5fr,auto] gap-4 items-end">
                                                        <div className="space-y-1.5">
                                                            <Label>Atributo</Label>
                                                            <Input placeholder="Ej. Color" value={currentAttrName} onChange={(e) => setCurrentAttrName(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label>Valores (separar con coma)</Label>
                                                            <Input placeholder="Ej. Rojo, Azul, Verde" value={currentAttrValues} onChange={(e) => setCurrentAttrValues(e.target.value)} />
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

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {variantAttributes.map((attr, idx) => (
                                                            <div key={idx} className="flex items-start justify-between bg-background border p-3 rounded-md shadow-sm">
                                                                <div className="overflow-hidden">
                                                                    <span className="font-bold text-sm block mb-1">{attr.name}:</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {attr.values.map((v, i) => <Badge key={i} variant="secondary" className="text-[10px]">{v}</Badge>)}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                                                    onClick={() => {
                                                                        const newAttrs = [...variantAttributes];
                                                                        newAttrs.splice(idx, 1);
                                                                        setVariantAttributes(newAttrs);
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
                                    ) : (
                                        <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/10">
                                            <p className="text-muted-foreground">La gestión de variantes existentes se realiza desde la vista de detalle del producto.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="pricing" className="mt-0 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-semibold">Reglas de Precios Aplicables</h3>
                                    <PricingRuleForm
                                        open={isPricingRuleFormOpen}
                                        onOpenChange={setIsPricingRuleFormOpen}
                                        onSuccess={fetchPricingRules}
                                        initialData={initialData ? { product: initialData.id, name: `Regla para ${initialData.name}` } : {}}
                                    />
                                    <Button type="button" size="sm" onClick={() => setIsPricingRuleFormOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Nueva Regla
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="h-9">Regla</TableHead>
                                                    <TableHead className="h-9">Origen</TableHead>
                                                    <TableHead className="h-9 text-right">Cant. Min</TableHead>
                                                    <TableHead className="h-9 text-right">Valor</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {/* Product Specific Rules */}
                                                {specificRules.map(rule => (
                                                    <TableRow key={rule.id} className="bg-primary/5">
                                                        <TableCell className="py-2 font-medium">{rule.name}</TableCell>
                                                        <TableCell className="py-2"><Badge variant="default" className="text-[10px]">Producto</Badge></TableCell>
                                                        <TableCell className="py-2 text-right">{Number(rule.min_quantity)}</TableCell>
                                                        <TableCell className="py-2 text-right font-bold">
                                                            {rule.rule_type === "FIXED" ? `$${Number(rule.fixed_price).toLocaleString()}` : `${Number(rule.discount_percentage)}%`}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {/* Category Inherited Rules */}
                                                {categoryRules.map(rule => (
                                                    <TableRow key={rule.id}>
                                                        <TableCell className="py-2">{rule.name}</TableCell>
                                                        <TableCell className="py-2"><Badge variant="outline" className="text-[10px]">Categoría</Badge></TableCell>
                                                        <TableCell className="py-2 text-right">{Number(rule.min_quantity)}</TableCell>
                                                        <TableCell className="py-2 text-right font-semibold">
                                                            {rule.rule_type === "FIXED" ? `$${Number(rule.fixed_price).toLocaleString()}` : `${Number(rule.discount_percentage)}%`}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {specificRules.length === 0 && categoryRules.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                            No hay reglas de precios definidas.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>

                            <div className="flex justify-end space-x-2 pt-6 border-t mt-8">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={loading} size="lg" className="px-8 shadow-md">
                                    {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Producto"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </Tabs>
            </DialogContent>
        </Dialog >
    )
}
