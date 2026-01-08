"use client"

import { useState, useEffect } from "react"
import { Plus, Package, Loader2, Pencil, X, Info, Trash2 } from "lucide-react"
import { useForm, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { PricingRuleForm } from "./PricingRuleForm"
import { Switch } from "@/components/ui/switch"
import { CategoryForm } from "./CategoryForm"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { CustomFieldTemplateForm } from "./CustomFieldTemplateForm"

const productSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    internal_code: z.string().optional().or(z.literal("")),
    name: z.string().min(2, "Nombre requerido"),
    category: z.string().min(1, "Categoría requerida"),
    product_type: z.string().min(1, "Tipo requerido"),
    sale_price: z.preprocess((v) => Number(v) || 0, z.number().min(0, "Mínimo 0")),
    uom: z.string().optional().or(z.literal("")),
    sale_uom: z.string().optional().or(z.literal("")),
    purchase_uom: z.string().optional().or(z.literal("")),
    allowed_sale_uoms: z.array(z.string()).default([]),
    image: z.any().optional(),
    track_inventory: z.boolean(),
    custom_fields_schema: z.string().optional(),
    // Manufacturing fields
    has_bom: z.boolean().default(false),
    requires_advanced_manufacturing: z.boolean().default(false),
    // Print Shop Workflow
    mfg_enable_prepress: z.boolean().default(false),
    mfg_enable_press: z.boolean().default(false),
    mfg_enable_postpress: z.boolean().default(false),
    mfg_prepress_design: z.boolean().default(false),
    mfg_prepress_specs: z.boolean().default(false),
    mfg_prepress_folio: z.boolean().default(false),
    mfg_press_offset: z.boolean().default(false),
    mfg_press_digital: z.boolean().default(false),
    mfg_postpress_finishing: z.boolean().default(false),
    mfg_postpress_binding: z.boolean().default(false),
    mfg_default_delivery_days: z.preprocess((v) => Number(v) || 3, z.number().min(0)),
    bom_name: z.string().optional().or(z.literal("")),
    bom_lines: z.array(z.object({
        component: z.string().min(1, "Componente requerido"),
        quantity: z.preprocess((v) => Number(v) || 0, z.number().min(0.0001, "Mínimo 0.0001")),
        unit: z.string().default("UN"),
        notes: z.string().optional(),
    })).default([]),
    product_custom_fields: z.array(z.object({
        template: z.preprocess((v) => Number(v), z.number()),
        order: z.number().default(0)
    })).default([]),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any
    onSuccess: () => void
}

export function ProductForm({ open, onOpenChange, initialData, onSuccess }: ProductFormProps) {
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [uoms, setUoms] = useState<any[]>([])
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)

    // Manufacturing state
    const [hasBom, setHasBom] = useState(initialData?.has_bom ?? false);
    const [requiresAdvanced, setRequiresAdvanced] = useState(initialData?.requires_advanced_manufacturing ?? false);
    const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
    const [fieldTemplates, setFieldTemplates] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])

    // Add Manufacturing tab to TabsList
    // Insert after existing tabs (assume after "General" tab)
    // We'll locate the TabsList rendering and add a new TabsTrigger
    // Also add TabsContent for manufacturing fields
    // Add import for AdvancedManufacturingDialog at top
    // Include dialog component at end of return

    const [selectedPricingRule, setSelectedPricingRule] = useState<any>(null)
    const [pricingRuleDialogOpen, setPricingRuleDialogOpen] = useState(false)
    const [pricingRules, setPricingRules] = useState<any[]>([])

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            code: "",
            internal_code: "",
            name: "",
            category: "",
            product_type: "STORABLE",
            sale_price: 0,
            uom: "",
            sale_uom: "",
            purchase_uom: "",
            allowed_sale_uoms: [],
            track_inventory: true,
            custom_fields_schema: "",
            image: undefined,
            has_bom: false,
            requires_advanced_manufacturing: false,
            mfg_enable_prepress: false,
            mfg_enable_press: false,
            mfg_enable_postpress: false,
            mfg_prepress_design: false,
            mfg_prepress_specs: false,
            mfg_prepress_folio: false,
            mfg_press_offset: false,
            mfg_press_digital: false,
            mfg_postpress_finishing: false,
            mfg_postpress_binding: false,
            mfg_default_delivery_days: 3,
            bom_name: "",
            bom_lines: [],
            product_custom_fields: [],
        },
    })

    const { fields: bomFields, append: appendBom, remove: removeBom } = useFieldArray({
        control: form.control,
        name: "bom_lines"
    })

    const { fields: pcfFields, append: appendPcf, remove: removePcf } = useFieldArray({
        control: form.control,
        name: "product_custom_fields"
    })

    const salePrice = form.watch("sale_price") || 0
    const ivaCalculated = Math.round(Number(salePrice) * 0.19)
    const totalCalculated = Math.round(Number(salePrice) + ivaCalculated)

    const fetchCategories = async () => {
        try {
            const res = await api.get('/inventory/categories/')
            setCategories(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching categories", error)
        }
    }

    const fetchUoMs = async () => {
        try {
            const res = await api.get('/inventory/uoms/')
            setUoms(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching UoMs", error)
        }
    }

    const fetchProducts = async () => {
        try {
            const res = await api.get('/inventory/products/')
            setProducts(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching products", error)
        }
    }

    const fetchPricingRules = async () => {
        if (!initialData?.id) return
        try {
            const res = await api.get(`/inventory/pricing-rules/?product=${initialData.id}`)
            setPricingRules(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching pricing rules", error)
        }
    }

    const [showTemplateForm, setShowTemplateForm] = useState(false)

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/inventory/custom-field-templates/')
            setFieldTemplates(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching templates", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchCategories()
            fetchUoMs()
            fetchTemplates()
            fetchProducts()
            if (initialData) {
                form.reset({
                    code: initialData.code || "",
                    internal_code: initialData.internal_code || "",
                    name: initialData.name || "",
                    category: initialData.category?.id?.toString() || initialData.category?.toString() || "",
                    product_type: initialData.product_type || "STORABLE",
                    sale_price: Number(initialData.sale_price) || 0,
                    uom: initialData.uom?.id?.toString() || initialData.uom?.toString() || "",
                    sale_uom: initialData.sale_uom?.id?.toString() || initialData.sale_uom?.toString() || "",
                    purchase_uom: initialData.purchase_uom?.id?.toString() || initialData.purchase_uom?.toString() || "",
                    allowed_sale_uoms: initialData.allowed_sale_uoms?.map((u: any) => u.id?.toString() || u.toString()) || [],
                    track_inventory: initialData.track_inventory ?? true,
                    custom_fields_schema: typeof initialData.custom_fields_schema === 'object'
                        ? JSON.stringify(initialData.custom_fields_schema, null, 2)
                        : initialData.custom_fields_schema || "",
                    has_bom: initialData.has_bom ?? false,
                    requires_advanced_manufacturing: initialData.requires_advanced_manufacturing ?? false,
                    mfg_enable_prepress: initialData.mfg_enable_prepress ?? false,
                    mfg_enable_press: initialData.mfg_enable_press ?? false,
                    mfg_enable_postpress: initialData.mfg_enable_postpress ?? false,
                    mfg_prepress_design: initialData.mfg_prepress_design ?? false,
                    mfg_prepress_specs: initialData.mfg_prepress_specs ?? false,
                    mfg_prepress_folio: initialData.mfg_prepress_folio ?? false,
                    mfg_press_offset: initialData.mfg_press_offset ?? false,
                    mfg_press_digital: initialData.mfg_press_digital ?? false,
                    mfg_postpress_finishing: initialData.mfg_postpress_finishing ?? false,
                    mfg_postpress_binding: initialData.mfg_postpress_binding ?? false,
                    mfg_default_delivery_days: initialData.mfg_default_delivery_days ?? 3,
                    bom_name: initialData.boms?.find((b: any) => b.active)?.name || "",
                    bom_lines: initialData.boms?.find((b: any) => b.active)?.lines.map((l: any) => ({
                        component: l.component?.toString() || "",
                        quantity: parseFloat(l.quantity) || 0,
                        unit: l.unit || "UN",
                        notes: l.notes || ""
                    })) || [],
                    product_custom_fields: initialData.product_custom_fields?.map((pcf: any) => ({
                        template: pcf.template,
                        order: pcf.order || 0
                    })) || [],
                })
                setImagePreview(initialData.image || null)
                fetchPricingRules()
            } else {
                form.reset({
                    code: "",
                    internal_code: "",
                    name: "",
                    category: "",
                    product_type: "STORABLE",
                    sale_price: 0,
                    uom: "",
                    sale_uom: "",
                    purchase_uom: "",
                    allowed_sale_uoms: [],
                    track_inventory: true,
                    custom_fields_schema: "",
                    image: undefined,
                    has_bom: false,
                    requires_advanced_manufacturing: false,
                    mfg_enable_prepress: false,
                    mfg_enable_press: false,
                    mfg_enable_postpress: false,
                    mfg_prepress_design: false,
                    mfg_prepress_specs: false,
                    mfg_prepress_folio: false,
                    mfg_press_offset: false,
                    mfg_press_digital: false,
                    mfg_postpress_finishing: false,
                    mfg_postpress_binding: false,
                    mfg_default_delivery_days: 3,
                    bom_name: "",
                    bom_lines: [],
                    product_custom_fields: [],
                })
                setImagePreview(null)
                setPricingRules([])
            }
        }
    }, [open, initialData])

    const onSubmit = async (data: ProductFormValues) => {
        setLoading(true)
        try {
            const formData = new FormData()
            if (data.code && data.code.trim()) {
                formData.append('code', data.code.trim())
            }
            formData.append('name', data.name)
            formData.append('category', data.category)
            formData.append('product_type', data.product_type)
            formData.append('sale_price', data.sale_price.toString())
            formData.append('uom', data.uom || '')
            formData.append('sale_uom', data.sale_uom || '')
            if (data.purchase_uom) formData.append('purchase_uom', data.purchase_uom)
            if (data.allowed_sale_uoms && data.allowed_sale_uoms.length > 0) {
                // M2M needs multiple appends or a comma separated string if backend handles it, 
                // but usually DRF expects multiple fields with same name or list in JSON.
                // Since this is Multipart, we append each ID.
                data.allowed_sale_uoms.forEach(id => formData.append('allowed_sale_uoms', id))
            }
            formData.append('track_inventory', data.track_inventory ? 'true' : 'false')

            // Manufacturing fields
            formData.append('has_bom', data.has_bom ? 'true' : 'false')
            formData.append('requires_advanced_manufacturing', data.requires_advanced_manufacturing ? 'true' : 'false')
            formData.append('mfg_enable_prepress', data.mfg_enable_prepress ? 'true' : 'false')
            formData.append('mfg_enable_press', data.mfg_enable_press ? 'true' : 'false')
            formData.append('mfg_enable_postpress', data.mfg_enable_postpress ? 'true' : 'false')
            formData.append('mfg_prepress_design', data.mfg_prepress_design ? 'true' : 'false')
            formData.append('mfg_prepress_specs', data.mfg_prepress_specs ? 'true' : 'false')
            formData.append('mfg_prepress_folio', data.mfg_prepress_folio ? 'true' : 'false')
            formData.append('mfg_press_offset', data.mfg_press_offset ? 'true' : 'false')
            formData.append('mfg_press_digital', data.mfg_press_digital ? 'true' : 'false')
            formData.append('mfg_postpress_finishing', data.mfg_postpress_finishing ? 'true' : 'false')
            formData.append('mfg_postpress_binding', data.mfg_postpress_binding ? 'true' : 'false')
            formData.append('mfg_default_delivery_days', data.mfg_default_delivery_days.toString())

            if (data.bom_name) formData.append('bom_name', data.bom_name)
            if (data.bom_lines && data.bom_lines.length > 0) {
                formData.append('bom_lines', JSON.stringify(data.bom_lines))
            }
            if (data.product_custom_fields && data.product_custom_fields.length > 0) {
                formData.append('product_custom_fields', JSON.stringify(data.product_custom_fields))
            }

            if (data.custom_fields_schema) {
                formData.append('custom_fields_schema', data.custom_fields_schema)
            }

            if (data.image instanceof File) {
                formData.append('image', data.image)
            } else if (imagePreview === null && initialData?.image) {
                // Image was cleared
                formData.append('image', '')
            }

            if (initialData) {
                await api.put(`/inventory/products/${initialData.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Producto actualizado", { description: "Cambios guardados correctamente." })
            } else {
                await api.post('/inventory/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Producto creado", { description: "El producto ha sido registrado." })
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving product", error)
            toast.error("Error", {
                description: error.response?.data?.detail || "No se pudo guardar el producto.",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1240px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-muted/20">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary" />
                        {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    <Form {...form}>
                        <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="mb-4 bg-muted/50 p-1">
                                    <TabsTrigger value="general" className="px-8 flex gap-2">
                                        Información General
                                    </TabsTrigger>
                                    {form.watch("product_type") === 'MANUFACTURABLE' && (
                                        <TabsTrigger value="manufacturing" className="px-8 flex gap-2">
                                            Fabricación
                                        </TabsTrigger>
                                    )}
                                    {initialData && (
                                        <TabsTrigger value="pricing" className="px-8 flex gap-2">
                                            Reglas de Precios
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="uoms" className="px-8 flex gap-2">
                                        Und. de Medida
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="general" className="mt-0 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* Left Column: Radio Group & Details */}
                                        <div className="md:col-span-3 space-y-6 border-r pr-8">
                                            <FormField<ProductFormValues>
                                                control={form.control}
                                                name="product_type"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-4">
                                                        <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tipo de Producto</FormLabel>
                                                        <FormControl>
                                                            <RadioGroup
                                                                onValueChange={(val) => {
                                                                    field.onChange(val);
                                                                    // Update track_inventory based on type
                                                                    if (val === 'STORABLE') {
                                                                        form.setValue('track_inventory', true);
                                                                    } else if (val === 'CONSUMABLE' || val === 'SERVICE') {
                                                                        form.setValue('track_inventory', false);
                                                                    }
                                                                    // MANUFACTURABLE retains current value or defaults
                                                                }}
                                                                value={field.value}
                                                                className="flex flex-col space-y-2"
                                                            >
                                                                {[
                                                                    { id: 'STORABLE', label: 'Almacenable' },
                                                                    { id: 'CONSUMABLE', label: 'Consumible' },
                                                                    { id: 'MANUFACTURABLE', label: 'Fabricable' },
                                                                    { id: 'SERVICE', label: 'Servicio' }
                                                                ].map((t) => (
                                                                    <FormItem key={t.id} className={`flex items-center space-x-3 space-y-0 p-3 rounded-xl border hover:bg-muted/50 transition-all ${!!initialData ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                        <FormControl>
                                                                            <RadioGroupItem value={t.id} disabled={!!initialData} />
                                                                        </FormControl>
                                                                        <FormLabel className={`font-medium flex-1 text-sm ${!!initialData ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                            {t.label}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                ))}
                                                            </RadioGroup>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="pt-2 pb-2">
                                                <FormField
                                                    control={form.control}
                                                    name="track_inventory"
                                                    render={({ field }) => (
                                                        <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
                                                            <div className="flex flex-col gap-1">
                                                                <Label className="text-sm font-bold">¿Controlar Stock?</Label>
                                                                <span className="text-[10px] text-muted-foreground">Gestionar niveles de inventario</span>
                                                            </div>
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                                disabled={
                                                                    form.watch("product_type") === 'STORABLE' ||
                                                                    form.watch("product_type") === 'CONSUMABLE' ||
                                                                    form.watch("product_type") === 'SERVICE'
                                                                }
                                                            />
                                                        </div>
                                                    )}
                                                />
                                            </div>


                                            <div className="pt-4 space-y-4">
                                                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Imagen del Producto</Label>
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="image"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <div className="relative group aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 overflow-hidden bg-muted/10 flex items-center justify-center transition-all hover:border-primary/50">
                                                                {imagePreview ? (
                                                                    <>
                                                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <Button
                                                                                type="button"
                                                                                variant="destructive"
                                                                                size="icon"
                                                                                className="rounded-full"
                                                                                onClick={() => {
                                                                                    setImagePreview(null)
                                                                                    field.onChange(null)
                                                                                }}
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <label className="flex flex-col items-center gap-2 cursor-pointer p-6 text-center">
                                                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                            <Plus className="h-6 w-6 text-primary" />
                                                                        </div>
                                                                        <span className="text-xs font-medium text-muted-foreground">Subir imagen</span>
                                                                        <input
                                                                            type="file"
                                                                            className="hidden"
                                                                            accept="image/*"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0]
                                                                                if (file) {
                                                                                    field.onChange(file)
                                                                                    const reader = new FileReader()
                                                                                    reader.onloadend = () => setImagePreview(reader.result as string)
                                                                                    reader.readAsDataURL(file)
                                                                                }
                                                                            }}
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        {/* Right Column: Information Grid */}
                                        <div className="md:col-span-9 space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                <div className="md:col-span-1">
                                                    {initialData && (
                                                        <FormField<ProductFormValues>
                                                            control={form.control}
                                                            name="internal_code"
                                                            render={({ field }) => (
                                                                <FormItem className="mb-4">
                                                                    <FormLabel className="text-primary font-bold">Código Interno</FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} readOnly className="bg-primary/5 font-mono font-bold border-primary/20" />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}
                                                    <FormField<ProductFormValues>
                                                        control={form.control}
                                                        name="code"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Código / SKU</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="AUTO-GEN" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <FormField<ProductFormValues>
                                                        control={form.control}
                                                        name="name"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Nombre Comercial</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Ej: Camiseta de Algodón Premium" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>


                                                <div className="md:col-span-4">
                                                    <FormField<ProductFormValues>
                                                        control={form.control}
                                                        name="category"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Categoría</FormLabel>
                                                                <div className="flex gap-2">
                                                                    <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="flex-1">
                                                                                <SelectValue placeholder="Seleccionar" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {categories.map((cat) => (
                                                                                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        className="shrink-0"
                                                                        onClick={() => setIsCategoryFormOpen(true)}
                                                                        title="Nueva Categoría"
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                                <FormField<ProductFormValues>
                                                    control={form.control}
                                                    name="sale_price"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Precio Venta Neto</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                                                    <Input type="number" className="pl-7 font-bold text-lg" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="space-y-2">
                                                    <Label className="text-muted-foreground">IVA (19%)</Label>
                                                    <div className="h-10 flex items-center px-3 rounded-md bg-muted/50 font-medium text-muted-foreground">
                                                        $ {ivaCalculated.toLocaleString()}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-primary font-bold">Total con IVA (Bruto)</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-primary/50">$</span>
                                                        <Input
                                                            type="number"
                                                            className="pl-7 bg-primary/10 border-primary/30 font-extrabold text-primary text-lg"
                                                            value={totalCalculated || ""}
                                                            onChange={(e) => {
                                                                const gross = Number(e.target.value);
                                                                const net = Math.round(gross / 1.19);
                                                                form.setValue("sale_price", net);
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {(initialData || Number(form.watch("sale_price")) > 0) && (
                                                    <div className="space-y-2">
                                                        <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Análisis de Margen</Label>
                                                        <div className={cn(
                                                            "h-10 flex items-center justify-between px-4 rounded-xl border text-sm font-bold shadow-sm transition-all animate-in fade-in zoom-in duration-300",
                                                            (1 - (Number(initialData?.cost_price || 0) / Number(salePrice))) * 100 > 30
                                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                                : (1 - (Number(initialData?.cost_price || 0) / Number(salePrice))) * 100 > 15
                                                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                                                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                                        )}>
                                                            <div className="flex items-center gap-2">
                                                                <Info className="h-4 w-4 opacity-70" />
                                                                <span>Costo: ${Number(initialData?.cost_price || 0).toLocaleString()}</span>
                                                            </div>
                                                            <Badge className={cn(
                                                                "px-2 py-0.5 rounded-lg text-[11px] font-black border-none shadow-none uppercase tracking-tighter",
                                                                (1 - (Number(initialData?.cost_price || 0) / Number(salePrice))) * 100 > 30
                                                                    ? "bg-emerald-500 text-white"
                                                                    : (1 - (Number(initialData?.cost_price || 0) / Number(salePrice))) * 100 > 15
                                                                        ? "bg-amber-500 text-white"
                                                                        : "bg-rose-500 text-white"
                                                            )}>
                                                                {Math.round((1 - (Number(initialData?.cost_price || 0) / Number(salePrice))) * 100)}% MARGEN
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="manufacturing" className="mt-0 space-y-6">
                                    {/* Row 1: Delivery Date Card + BOM Card */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Delivery Date Card */}
                                        <div className="p-6 rounded-2xl border bg-card">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={!!form.watch("mfg_default_delivery_days") && form.watch("mfg_default_delivery_days") > 0}
                                                        onCheckedChange={(checked) => {
                                                            form.setValue("mfg_default_delivery_days", checked ? 3 : 0)
                                                        }}
                                                    />
                                                    <div>
                                                        <h3 className="font-bold text-sm">Fecha de Entrega</h3>
                                                        <p className="text-[10px] text-muted-foreground">Configurar tiempo de producción</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {form.watch("mfg_default_delivery_days") > 0 && (
                                                <FormField
                                                    control={form.control}
                                                    name="mfg_default_delivery_days"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">Días de Entrega por Defecto</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} className="h-9" />
                                                            </FormControl>
                                                            <FormDescription className="text-[9px]">Tiempo estimado de producción estándar.</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </div>

                                        {/* BOM Card */}
                                        <div className="p-6 rounded-2xl border bg-card">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="has_bom"
                                                        render={({ field }) => (
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        )}
                                                    />
                                                    <div>
                                                        <h3 className="font-bold text-sm">Gestionar Materiales (BOM)</h3>
                                                        <p className="text-[10px] text-muted-foreground">Define componentes para control de stock</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {form.watch("has_bom") && (
                                                <div className="space-y-6 mt-4 pt-4 border-t">
                                                    <FormField
                                                        control={form.control}
                                                        name="bom_name"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">Nombre de la Lista</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Ej: Receta Estándar" {...field} className="h-9" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <div>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-sm font-bold">Componentes</h4>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-[10px] gap-1"
                                                                onClick={() => appendBom({ component: "", quantity: 1, unit: "UN", notes: "" })}
                                                            >
                                                                <Plus className="h-3 w-3" /> Añadir Componente
                                                            </Button>
                                                        </div>
                                                        <div className="rounded-md border bg-background overflow-hidden">
                                                            <Table>
                                                                <TableHeader className="bg-muted/30">
                                                                    <TableRow className="h-8">
                                                                        <TableHead className="text-[10px] h-8">Componente</TableHead>
                                                                        <TableHead className="text-[10px] h-8 w-[80px]">Cant.</TableHead>
                                                                        <TableHead className="text-[10px] h-8 w-[90px]">UdM</TableHead>
                                                                        <TableHead className="text-[10px] h-8">Notas</TableHead>
                                                                        <TableHead className="text-[10px] h-8 w-[40px]"></TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {bomFields.length > 0 ? (
                                                                        bomFields.map((field, index) => (
                                                                            <TableRow key={field.id} className="h-10 hover:bg-muted/10">
                                                                                <TableCell className="p-1">
                                                                                    <FormField
                                                                                        control={form.control}
                                                                                        name={`bom_lines.${index}.component`}
                                                                                        render={({ field: selectField }) => (
                                                                                            <ProductSelector
                                                                                                value={selectField.value}
                                                                                                onChange={(val) => {
                                                                                                    selectField.onChange(val);
                                                                                                    const selectedProd = products.find((p: any) => p.id.toString() === val);
                                                                                                    if (selectedProd) {
                                                                                                        form.setValue(`bom_lines.${index}.unit`, (selectedProd.uom?.name || selectedProd.uom_name || "UN"));
                                                                                                        if (!form.getValues(`bom_lines.${index}.quantity`)) {
                                                                                                            form.setValue(`bom_lines.${index}.quantity`, 1);
                                                                                                        }
                                                                                                    }
                                                                                                }}
                                                                                                placeholder="Buscar..."
                                                                                            />
                                                                                        )}
                                                                                    />
                                                                                </TableCell>
                                                                                <TableCell className="p-1">
                                                                                    <FormField
                                                                                        control={form.control}
                                                                                        name={`bom_lines.${index}.quantity`}
                                                                                        render={({ field: qField }) => (
                                                                                            <Input
                                                                                                type="number"
                                                                                                step="0.0001"
                                                                                                {...qField}
                                                                                                className="h-7 text-[10px] font-mono px-2"
                                                                                                onChange={(e) => qField.onChange(parseFloat(e.target.value) || 0)}
                                                                                            />
                                                                                        )}
                                                                                    />
                                                                                </TableCell>
                                                                                <TableCell className="p-1">
                                                                                    <FormField
                                                                                        control={form.control}
                                                                                        name={`bom_lines.${index}.unit`}
                                                                                        render={({ field: uField }) => (
                                                                                            <Select onValueChange={uField.onChange} value={uField.value}>
                                                                                                <FormControl>
                                                                                                    <SelectTrigger className="h-7 text-[10px] px-2 min-w-[70px]">
                                                                                                        <SelectValue />
                                                                                                    </SelectTrigger>
                                                                                                </FormControl>
                                                                                                <SelectContent>
                                                                                                    <SelectItem value="UN">UN</SelectItem>
                                                                                                    <SelectItem value="KG">KG</SelectItem>
                                                                                                    <SelectItem value="MT">MT</SelectItem>
                                                                                                    <SelectItem value="LT">LT</SelectItem>
                                                                                                    <SelectItem value="PL">PL</SelectItem>
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        )}
                                                                                    />
                                                                                </TableCell>
                                                                                <TableCell className="p-1">
                                                                                    <FormField
                                                                                        control={form.control}
                                                                                        name={`bom_lines.${index}.notes`}
                                                                                        render={({ field: nField }) => (
                                                                                            <Input
                                                                                                {...nField}
                                                                                                className="h-7 text-[10px] px-2"
                                                                                                placeholder="..."
                                                                                            />
                                                                                        )}
                                                                                    />
                                                                                </TableCell>
                                                                                <TableCell className="p-1 text-center">
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 text-destructive"
                                                                                        onClick={() => removeBom(index)}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))
                                                                    ) : (
                                                                        <TableRow>
                                                                            <TableCell colSpan={5} className="text-center py-4 text-[10px] text-muted-foreground italic">
                                                                                No se han definido componentes.
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Advanced Manufacturing Card - Full Width */}
                                    <div className="p-6 rounded-2xl border bg-card space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FormField
                                                    control={form.control}
                                                    name="requires_advanced_manufacturing"
                                                    render={({ field }) => (
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    )}
                                                />
                                                <div>
                                                    <h3 className="font-bold text-sm">Requiere Fabricación Avanzada</h3>
                                                    <p className="text-[10px] text-muted-foreground">Captura datos adicionales al vender este producto (Imprenta)</p>
                                                </div>
                                            </div>
                                        </div>

                                        {form.watch("requires_advanced_manufacturing") && (
                                            <div className="space-y-6">
                                                {/* 3 Stage Switches */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="mfg_enable_prepress"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-xs font-bold">Pre-Impresión</FormLabel>
                                                                    <FormDescription className="text-[9px]">Diseño y preparación</FormDescription>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="mfg_enable_press"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-xs font-bold">Impresión</FormLabel>
                                                                    <FormDescription className="text-[9px]">Proceso de impresión</FormDescription>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="mfg_enable_postpress"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-xs font-bold">Post-Impresión</FormLabel>
                                                                    <FormDescription className="text-[9px]">Acabados finales</FormDescription>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                {/* Stage-Specific Options */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Pre-Impresión</h4>
                                                        <div className="space-y-2">
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_prepress_design"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_prepress")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Diseño Requerido</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_prepress_specs"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_prepress")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Especificaciones</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_prepress_folio"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_prepress")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Folio</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Impresión</h4>
                                                        <div className="space-y-2">
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_press_offset"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_press")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Offset</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_press_digital"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_press")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Digital</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Post-Impresión</h4>
                                                        <div className="space-y-2">
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_postpress_finishing"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_postpress")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Acabados</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="mfg_postpress_binding"
                                                                render={({ field }) => (
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                disabled={!form.watch("mfg_enable_postpress")}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="text-xs font-normal cursor-pointer">Encuadernación / Troquelado</FormLabel>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="uoms" className="mt-0 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                                                <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                                                    <Info className="h-4 w-4" />
                                                    Gestión de Unidades
                                                </h3>
                                                <div className="space-y-4">
                                                    {/* Stock UoM: Only if tracking inventory */}
                                                    {form.watch("track_inventory") && (
                                                        <FormField<ProductFormValues>
                                                            control={form.control}
                                                            name="uom"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Unidad de Medida de Stock (Base)</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Seleccionar unidad base" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {uoms.map((u) => (
                                                                                <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormDescription className="text-[10px]">
                                                                        Esta unidad se utilizará para el conteo de inventario y valoración.
                                                                    </FormDescription>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    )}

                                                    {/* Purchase UoM: Storable, Consumable, or Manufacturable with Stock */}
                                                    {(form.watch("product_type") === 'STORABLE' ||
                                                        form.watch("product_type") === 'CONSUMABLE' ||
                                                        (form.watch("product_type") === 'MANUFACTURABLE' && form.watch("track_inventory"))) && (
                                                            <FormField<ProductFormValues>
                                                                control={form.control}
                                                                name="purchase_uom"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Unidad de Medida de Compra</FormLabel>
                                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                                            <FormControl>
                                                                                <SelectTrigger>
                                                                                    <SelectValue placeholder="Opcional" />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                {uoms.map((u) => (
                                                                                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        )}

                                                    {/* Sale UoM: Storable, Service, Manufacturable */}
                                                    {(form.watch("product_type") === 'STORABLE' ||
                                                        form.watch("product_type") === 'MANUFACTURABLE' ||
                                                        form.watch("product_type") === 'SERVICE') && (
                                                            <FormField<ProductFormValues>
                                                                control={form.control}
                                                                name="sale_uom"
                                                                render={({ field }) => {
                                                                    const filteredUoms = uoms;
                                                                    const isDisabled = false;

                                                                    return (
                                                                        <FormItem>
                                                                            <FormLabel>Unidad de Medida de Venta por Defecto</FormLabel>
                                                                            <Select
                                                                                onValueChange={field.onChange}
                                                                                value={field.value}
                                                                                disabled={isDisabled}
                                                                            >
                                                                                <FormControl>
                                                                                    <SelectTrigger>
                                                                                        <SelectValue placeholder="Requerido para ventas" />
                                                                                    </SelectTrigger>
                                                                                </FormControl>
                                                                                <SelectContent>
                                                                                    {filteredUoms.map((u) => (
                                                                                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                            {/* Removed dependency on Stock UoM */}
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    );
                                                                }}
                                                            />
                                                        )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {(form.watch("product_type") === 'STORABLE' ||
                                                form.watch("product_type") === 'MANUFACTURABLE' ||
                                                form.watch("product_type") === 'SERVICE') && (
                                                    <div className="p-6 rounded-2xl border bg-card/50">
                                                        <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                                            Unidades de Venta Permitidas
                                                        </h3>
                                                        <p className="text-[11px] text-muted-foreground mb-4">
                                                            Define explícitamente qué unidades estarán disponibles al vender.
                                                            Una vez seleccionada la primera, las demás deben ser de la misma categoría.
                                                        </p>

                                                        <FormField<ProductFormValues>
                                                            control={form.control}
                                                            name="allowed_sale_uoms"
                                                            render={({ field }) => {
                                                                const selectedIds = field.value || [];
                                                                const saleUomId = form.watch("sale_uom");
                                                                const saleUom = uoms.find(u => u.id.toString() === saleUomId);
                                                                const categoryId = saleUom?.category;
                                                                const isDisabled = !saleUomId;

                                                                const sortedUoms = [...uoms].sort((a, b) => {
                                                                    const catCompare = (a.category_name || "").localeCompare(b.category_name || "");
                                                                    if (catCompare !== 0) return catCompare;
                                                                    return a.name.localeCompare(b.name);
                                                                });

                                                                return (
                                                                    <FormItem>
                                                                        <div className={cn("space-y-3", isDisabled && "opacity-50 pointer-events-none")}>
                                                                            <div className="flex flex-wrap gap-2 mb-2">
                                                                                {selectedIds.map((id: string) => {
                                                                                    const uom = uoms.find((u: any) => u.id.toString() === id);
                                                                                    return (
                                                                                        <Badge key={id} variant="secondary" className="pl-3 pr-1 py-1 gap-2 rounded-lg">
                                                                                            {uom?.name}
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-4 w-4 rounded-full hover:bg-destructive hover:text-white"
                                                                                                onClick={() => field.onChange(selectedIds.filter((i: string) => i !== id))}
                                                                                            >
                                                                                                <X className="h-2 w-2" />
                                                                                            </Button>
                                                                                        </Badge>
                                                                                    );
                                                                                })}
                                                                                {selectedIds.length === 0 && (
                                                                                    <span className="text-[10px] text-muted-foreground italic">
                                                                                        {isDisabled ? "Seleccione unidad por defecto primero." : "Ninguna seleccionada. Se usará la unidad por defecto."}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[300px] p-1 border rounded-xl bg-muted/20">
                                                                                {sortedUoms.map((u: any) => {
                                                                                    const isSelected = selectedIds.includes(u.id.toString());
                                                                                    const isDifferentCategory = categoryId !== undefined && u.category !== categoryId;
                                                                                    const itemDisabled = isDisabled || isDifferentCategory;

                                                                                    return (
                                                                                        <div
                                                                                            key={u.id}
                                                                                            className={cn(
                                                                                                "flex items-center space-x-2 p-2 rounded-lg border transition-all cursor-pointer",
                                                                                                isSelected ? "bg-primary/10 border-primary/30" : "bg-background border-transparent hover:border-muted-foreground/30",
                                                                                                itemDisabled && "opacity-30 cursor-not-allowed grayscale pointer-events-none"
                                                                                            )}
                                                                                            onClick={() => {
                                                                                                if (itemDisabled) return;
                                                                                                if (isSelected) {
                                                                                                    field.onChange(selectedIds.filter((id: string) => id !== u.id.toString()));
                                                                                                } else {
                                                                                                    field.onChange([...selectedIds, u.id.toString()]);
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <Checkbox
                                                                                                checked={isSelected}
                                                                                                disabled={itemDisabled}
                                                                                                className="rounded"
                                                                                            />
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-[11px] font-medium leading-tight">{u.name}</span>
                                                                                                <span className="text-[9px] text-muted-foreground leading-tight">{u.category_name}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {saleUom && (
                                                                                <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                                                                                    <Info className="h-3 w-3" />
                                                                                    Filtrado por categoría de venta: {saleUom.category_name}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="pricing" className="mt-0">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border">
                                            <div className="flex gap-4 items-center">
                                                <div className="p-2 rounded-lg bg-primary/10">
                                                    <Info className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">Políticas de Precios Dinámicas</h3>
                                                    <p className="text-xs text-muted-foreground">Las reglas se aplican automáticamente según la cantidad y vigencia.</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="sm"
                                                onClick={() => setPricingRuleDialogOpen(true)}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Nueva Regla
                                            </Button>
                                        </div>

                                        {!initialData && (
                                            <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center px-6">
                                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                                    <Pencil className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <h4 className="font-medium text-muted-foreground">Debe crear el producto primero</h4>
                                                <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Las reglas de precios específicas requieren que el producto esté registrado en el sistema.</p>
                                            </div>
                                        )}

                                        {initialData && (
                                            <div className="border rounded-2xl overflow-hidden shadow-sm">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                                                            <TableHead>Nivel</TableHead>
                                                            <TableHead>Descripción / Vigencia</TableHead>
                                                            <TableHead>Cant. Mín</TableHead>
                                                            <TableHead className="text-right">Precio / Descuento</TableHead>
                                                            <TableHead className="text-center w-[100px]">Estado</TableHead>
                                                            <TableHead className="text-right w-[60px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {pricingRules.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                                                                    No hay reglas personalizadas para este producto.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            pricingRules.map((rule) => {
                                                                const isProductRule = rule.product !== null;
                                                                return (
                                                                    <TableRow key={rule.id} className="group transition-colors">
                                                                        <TableCell>
                                                                            <Badge variant={isProductRule ? "default" : "outline"} className="text-[10px] uppercase font-bold px-1.5">
                                                                                {isProductRule ? "Producto" : "Categoría"}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-sm">{rule.name}</span>
                                                                                {(rule.start_date || rule.end_date) && (
                                                                                    <span className="text-[10px] text-muted-foreground font-medium flex gap-2">
                                                                                        <span>📅 {rule.start_date || '∞'}</span>
                                                                                        <span>➜</span>
                                                                                        <span>{rule.end_date || '∞'}</span>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-sm font-semibold tabular-nums">{Number(rule.min_quantity)} unidad(es)</TableCell>
                                                                        <TableCell className="text-right font-black text-primary">
                                                                            {rule.rule_type === 'FIXED'
                                                                                ? `$ ${Number(rule.fixed_price).toLocaleString()}`
                                                                                : `-${Number(rule.discount_percentage)}%`}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            <div className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase ${rule.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                                                                {rule.active ? "Activa" : "Inactiva"}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-right flex gap-1 justify-end">
                                                                            {isProductRule && (
                                                                                <>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        onClick={() => {
                                                                                            setSelectedPricingRule(rule)
                                                                                            setPricingRuleDialogOpen(true)
                                                                                        }}
                                                                                    >
                                                                                        <Pencil className="h-3 w-3" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        onClick={async () => {
                                                                                            if (confirm("¿Estás seguro de eliminar esta regla?")) {
                                                                                                try {
                                                                                                    await api.delete(`/inventory/pricing-rules/${rule.id}/`)
                                                                                                    toast.success("Regla eliminada")
                                                                                                    fetchPricingRules()
                                                                                                } catch (error) {
                                                                                                    toast.error("Error al eliminar la regla")
                                                                                                }
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-6 py-4 border-t gap-2 bg-muted/10 shrink-0">
                    <Button variant="outline" className="h-11 min-w-[120px] rounded-xl font-bold" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        form="product-form"
                        type="submit"
                        disabled={loading}
                        className="min-w-[160px] rounded-xl h-11 font-bold shadow-lg shadow-primary/20"
                    >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (initialData ? 'Guardar Cambios' : 'Crear Producto')}
                    </Button>
                </DialogFooter>
            </DialogContent >

            <PricingRuleForm
                open={pricingRuleDialogOpen}
                onOpenChange={(open) => {
                    setPricingRuleDialogOpen(open)
                    if (!open) setSelectedPricingRule(null)
                }}
                initialData={selectedPricingRule}
                onSuccess={fetchPricingRules}
                productId={initialData?.id}
            />

            <CategoryForm
                open={isCategoryFormOpen}
                onOpenChange={setIsCategoryFormOpen}
                onSuccess={(newCat: any) => {
                    setCategories(prev => [...prev, newCat])
                    form.setValue("category", newCat.id.toString())
                }}
            />

            <CustomFieldTemplateForm
                open={showTemplateForm}
                onOpenChange={setShowTemplateForm}
                onSuccess={(newTemplate: any) => {
                    setFieldTemplates(prev => [...prev, newTemplate])
                }}
            />
        </Dialog >
    )
}
