"use client"

import { useState, useEffect } from "react"
import { Plus, Package, Loader2, Pencil, X, Info } from "lucide-react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "@/hooks/use-toast"
import api from "@/lib/api"

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
import { Label } from "@/components/ui/label"
import { PricingRuleForm } from "./PricingRuleForm"
import { CategoryForm } from "./CategoryForm"

const productSchema = z.object({
    code: z.string().min(1, "Código requerido"),
    name: z.string().min(2, "Nombre requerido"),
    category: z.string().min(1, "Categoría requerida"),
    product_type: z.string().min(1, "Tipo requerido"),
    sale_price: z.coerce.number().min(0, "Mínimo 0"),
    uom: z.string().min(1, "Unidad de medida requerida"),
    purchase_uom: z.string().optional(),
    image: z.any().optional(),
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

    // Pricing Rules State
    const [pricingRules, setPricingRules] = useState<any[]>([])
    const [selectedPricingRule, setSelectedPricingRule] = useState<any>(null)
    const [pricingRuleDialogOpen, setPricingRuleDialogOpen] = useState(false)

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            code: "",
            name: "",
            category: "",
            product_type: "STORABLE",
            sale_price: 0,
            uom: "",
            purchase_uom: "",
        },
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

    const fetchPricingRules = async () => {
        if (!initialData?.id) return
        try {
            const res = await api.get(`/inventory/pricing-rules/?product=${initialData.id}`)
            setPricingRules(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching pricing rules", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchCategories()
            fetchUoMs()
            if (initialData) {
                form.reset({
                    code: initialData.code || "",
                    name: initialData.name || "",
                    category: initialData.category?.id?.toString() || initialData.category?.toString() || "",
                    product_type: initialData.product_type || "STORABLE",
                    sale_price: Number(initialData.sale_price) || 0,
                    uom: initialData.uom?.id?.toString() || initialData.uom?.toString() || "",
                    purchase_uom: initialData.purchase_uom?.id?.toString() || initialData.purchase_uom?.toString() || "",
                })
                setImagePreview(initialData.image || null)
                fetchPricingRules()
            } else {
                form.reset({
                    code: "",
                    name: "",
                    category: "",
                    product_type: "STORABLE",
                    sale_price: 0,
                    uom: "",
                    purchase_uom: "",
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
            formData.append('code', data.code)
            formData.append('name', data.name)
            formData.append('category', data.category)
            formData.append('product_type', data.product_type)
            formData.append('sale_price', data.sale_price.toString())
            formData.append('uom', data.uom)
            if (data.purchase_uom) formData.append('purchase_uom', data.purchase_uom)

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
                toast({ title: "Producto actualizado", description: "Cambios guardados correctamente." })
            } else {
                await api.post('/inventory/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast({ title: "Producto creado", description: "El producto ha sido registrado." })
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving product", error)
            toast({
                title: "Error",
                description: error.response?.data?.detail || "No se pudo guardar el producto.",
                variant: "destructive"
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
                                    <TabsTrigger value="pricing" className="px-8 flex gap-2">
                                        Reglas de Precios
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="general" className="mt-0 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* Left Column: Radio Group & Details */}
                                        <div className="md:col-span-3 space-y-6 border-r pr-8">
                                            <FormField
                                                control={form.control}
                                                name="product_type"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-4">
                                                        <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tipo de Producto</FormLabel>
                                                        <FormControl>
                                                            <RadioGroup
                                                                onValueChange={field.onChange}
                                                                defaultValue={field.value}
                                                                className="flex flex-col space-y-2"
                                                            >
                                                                {['STORABLE', 'SERVICE', 'CONSUMABLE', 'MANUFACTURABLE'].map((type) => (
                                                                    <FormItem key={type} className="flex items-center space-x-3 space-y-0 p-3 rounded-xl border hover:bg-muted/50 transition-all cursor-pointer">
                                                                        <FormControl>
                                                                            <RadioGroupItem value={type} />
                                                                        </FormControl>
                                                                        <FormLabel className="font-medium cursor-pointer flex-1 text-sm">
                                                                            {type === 'STORABLE' ? 'Almacenable' :
                                                                                type === 'SERVICE' ? 'Servicio' :
                                                                                    type === 'CONSUMABLE' ? 'Consumible' : 'Fabricable'}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                ))}
                                                            </RadioGroup>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="pt-4 space-y-4">
                                                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Imagen del Producto</Label>
                                                <FormField
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
                                                    <FormField
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
                                                    <FormField
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

                                                <div className="md:col-span-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="category"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="flex justify-between items-center">
                                                                    Categoría
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        className="h-auto p-0 text-xs text-primary"
                                                                        onClick={() => setIsCategoryFormOpen(true)}
                                                                    >
                                                                        <Plus className="h-3 w-3 mr-1" /> Nueva
                                                                    </Button>
                                                                </FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Seleccionar" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {categories.map((cat) => (
                                                                            <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="md:col-span-1">
                                                    <FormField
                                                        control={form.control}
                                                        name="uom"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>UdM Stock</FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Base" />
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
                                                </div>

                                                <div className="md:col-span-1">
                                                    <FormField
                                                        control={form.control}
                                                        name="purchase_uom"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>UdM Compra</FormLabel>
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
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                                <FormField
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
                                                    <Label className="text-primary font-bold">Total con IVA</Label>
                                                    <div className="h-10 flex items-center px-3 rounded-md bg-primary/10 border border-primary/20 font-extrabold text-primary text-lg">
                                                        $ {totalCalculated.toLocaleString()}
                                                    </div>
                                                </div>

                                                {initialData && (
                                                    <div className="space-y-2">
                                                        <Label className="text-muted-foreground">Costo Actual</Label>
                                                        <div className="h-10 flex items-center justify-between px-3 rounded-md bg-muted/30 border border-muted text-sm font-semibold">
                                                            <span>$ {Number(initialData.cost_price).toLocaleString()}</span>
                                                            <Badge variant="outline" className="h-5 text-[10px]">
                                                                {Math.round((1 - (Number(initialData.cost_price) / Number(initialData.sale_price))) * 100)}% mg
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
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
                                                disabled={!initialData}
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
                                                                        <TableCell className="text-right">
                                                                            {isProductRule && (
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        form="product-form"
                        type="submit"
                        disabled={loading}
                        className="min-w-[160px] rounded-xl h-11 font-bold shadow-lg shadow-primary/20"
                    >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (initialData ? 'Guardar Cambios' : 'Crear Producto')}
                    </Button>
                </DialogFooter>

                <PricingRuleForm
                    open={pricingRuleDialogOpen}
                    onOpenChange={(open) => {
                        setPricingRuleDialogOpen(open)
                        if (!open) setSelectedPricingRule(null)
                    }}
                    initialData={selectedPricingRule}
                    productId={initialData?.id || null}
                    productData={initialData}
                    onSuccess={fetchPricingRules}
                />

                <CategoryForm
                    open={isCategoryFormOpen}
                    onOpenChange={setIsCategoryFormOpen}
                    onSuccess={fetchCategories}
                />
            </DialogContent>
        </Dialog>
    )
}
