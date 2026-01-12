"use client"

import { useState, useEffect } from "react"
import { Package, Loader2, AlertCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { productSchema, type ProductFormValues } from "./product/schema"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import modular components
import { ProductTypeSelector } from "./product/ProductTypeSelector"
import { ProductImageUpload } from "./product/ProductImageUpload"
import { ProductBasicInfo } from "./product/ProductBasicInfo"
import { ProductPricingSection } from "./product/ProductPricingSection"
import { ProductInventoryTab } from "./product/ProductInventoryTab"
import { ProductManufacturingTab } from "./product/ProductManufacturingTab"
import { ProductPricingTab } from "./product/ProductPricingTab"
import { ProductUoMTab } from "./product/ProductUoMTab"

// Import dialogs
import { PricingRuleForm } from "./PricingRuleForm"
import { CategoryForm } from "./CategoryForm"

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
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [pricingRules, setPricingRules] = useState<any[]>([])
    const [selectedPricingRule, setSelectedPricingRule] = useState<any>(null)
    const [pricingRuleDialogOpen, setPricingRuleDialogOpen] = useState(false)

    // State for Replenishment Rules
    const [reorderingRules, setReorderingRules] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState("general")

    // Helper function to map field errors to tabs
    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: number } = {}

        // General tab fields
        const generalFields = ['name', 'category', 'product_type', 'sale_price', 'can_be_sold', 'can_be_purchased']
        generalFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['general'] = (tabErrors['general'] || 0) + 1
            }
        })

        // Manufacturing tab fields
        const mfgFields = ['boms', 'has_bom', 'mfg_auto_finalize']
        mfgFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['manufacturing'] = (tabErrors['manufacturing'] || 0) + 1
            }
        })

        // UoM tab fields
        const uomFields = ['uom', 'sale_uom', 'purchase_uom', 'allowed_sale_uoms']
        uomFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['uoms'] = (tabErrors['uoms'] || 0) + 1
            }
        })

        return tabErrors
    }

    const tabErrors = getTabsWithErrors()

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
            mfg_auto_finalize: false,
            boms: [],
            product_custom_fields: [],
        },
    })

    const productType = form.watch("product_type")

    // Logic for inventory tracking defaults and locking
    useEffect(() => {
        if (productType === "STORABLE") {
            if (!form.getValues("track_inventory")) form.setValue("track_inventory", true)
        } else if (productType === "CONSUMABLE" || productType === "SERVICE") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false)
        }
        // For MANUFACTURABLE, we leave it as is (unlocked, user decides), 
        // ensuring we don't overwrite saved data or user choice unless we want to enforce a default on change.
    }, [productType, form])

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

    const fetchWarehouses = async () => {
        try {
            const res = await api.get('/inventory/warehouses/')
            setWarehouses(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching Warehouses", error)
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

    useEffect(() => {
        if (open) {
            fetchCategories()
            fetchUoMs()
            fetchProducts()
            fetchWarehouses()
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
                    can_be_sold: initialData.can_be_sold ?? true,
                    can_be_purchased: initialData.can_be_purchased ?? true,
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
                    mfg_auto_finalize: initialData.mfg_auto_finalize ?? false,
                    boms: initialData.boms?.map((b: any) => ({
                        id: b.id,
                        name: b.name || "",
                        active: b.active || false,
                        lines: b.lines.map((l: any) => ({
                            id: l.id,
                            component: l.component?.toString() || "",
                            quantity: parseFloat(l.quantity) || 0,
                            uom: l.uom?.toString() || undefined,
                            notes: l.notes || ""
                        }))
                    })) || [],
                    product_custom_fields: initialData.product_custom_fields?.map((pcf: any) => ({
                        template: pcf.template,
                        order: pcf.order || 0
                    })) || [],
                })
                setImagePreview(initialData.image || null)
                fetchPricingRules()
                setReorderingRules(initialData.reordering_rules || [])
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
                    can_be_sold: true,
                    can_be_purchased: true,
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
                    mfg_auto_finalize: false,
                    boms: [],
                    product_custom_fields: [],
                })
                setImagePreview(null)
                setPricingRules([])
                setReorderingRules([])
            }
        }
    }, [open, initialData])

    const onSubmitError = (errors: any) => {
        console.log("Form validation errors:", errors)
        const tabsWithErrors = getTabsWithErrors()
        const firstErrorTab = Object.keys(tabsWithErrors)[0]

        if (firstErrorTab) {
            setActiveTab(firstErrorTab)
            toast.error("Formulario incompleto", {
                description: "Por favor complete todos los campos requeridos. Revise las pestañas marcadas en rojo."
            })
        }
    }

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
                data.allowed_sale_uoms.forEach(id => formData.append('allowed_sale_uoms', id))
            }
            formData.append('track_inventory', data.track_inventory ? 'true' : 'false')
            formData.append('can_be_sold', data.can_be_sold ? 'true' : 'false')
            formData.append('can_be_purchased', data.can_be_purchased ? 'true' : 'false')

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
            formData.append('mfg_auto_finalize', data.mfg_auto_finalize ? 'true' : 'false')

            if (!initialData && data.boms && data.boms.length > 0) {
                formData.append('boms', JSON.stringify(data.boms))
            }
            if (data.product_custom_fields && data.product_custom_fields.length > 0) {
                formData.append('product_custom_fields', JSON.stringify(data.product_custom_fields))
            }

            // Append Replenishment Rules
            if (reorderingRules && reorderingRules.length > 0) {
                formData.append('reordering_rules', JSON.stringify(reorderingRules))
            }

            if (data.custom_fields_schema) {
                formData.append('custom_fields_schema', data.custom_fields_schema)
            }

            if (data.image instanceof File) {
                formData.append('image', data.image)
            } else if (imagePreview === null && initialData?.image) {
                formData.append('image', '')
            }

            if (initialData) {
                await api.put(`/inventory/products/${initialData.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Producto actualizado")
            } else {
                await api.post('/inventory/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Producto creado")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving product", error)

            let errorMessage = "No se pudo guardar el producto."
            const errorData = error.response?.data

            if (errorData) {
                if (typeof errorData === 'object') {
                    // Extract first field error if available
                    const firstError = Object.entries(errorData)[0]
                    if (firstError) {
                        const [field, message] = firstError
                        errorMessage = `${field}: ${Array.isArray(message) ? message[0] : message}`
                    }
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData
                }
            }

            toast.error("Error al guardar", {
                description: errorMessage,
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
                        <form id="product-form" onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-6">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="mb-4 bg-muted/50 p-1">
                                    <TabsTrigger value="general" className="px-8 flex gap-2 relative">
                                        Información General
                                        {tabErrors['general'] && (
                                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                                <AlertCircle className="h-3 w-3" />
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    {(form.watch("product_type") === 'MANUFACTURABLE' || form.watch("has_bom")) && (
                                        <TabsTrigger value="manufacturing" className="px-8 flex gap-2 relative">
                                            Fabricación
                                            {tabErrors['manufacturing'] && (
                                                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                                    <AlertCircle className="h-3 w-3" />
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="inventory" className="px-8 flex gap-2">
                                        Inventario
                                    </TabsTrigger>
                                    <TabsTrigger value="uoms" className="px-8 flex gap-2 relative">
                                        Und. de Medida
                                        {tabErrors['uoms'] && (
                                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                                <AlertCircle className="h-3 w-3" />
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    {form.watch("can_be_sold") && (
                                        <TabsTrigger value="pricing" className="px-8 flex gap-2">
                                            Reglas de Precios
                                        </TabsTrigger>
                                    )}
                                </TabsList>

                                <TabsContent value="general" className="mt-0 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        <div className="md:col-span-3 space-y-6 border-r pr-8">
                                            <ProductTypeSelector form={form as any} disabled={!!initialData} />
                                            <ProductImageUpload
                                                form={form as any}
                                                imagePreview={imagePreview}
                                                setImagePreview={setImagePreview}
                                            />
                                        </div>

                                        <div className="md:col-span-9 space-y-8">
                                            <ProductBasicInfo
                                                form={form as any}
                                                categories={categories}
                                                isEditing={!!initialData}
                                                onAddCategory={() => setIsCategoryFormOpen(true)}
                                            />
                                            <ProductPricingSection
                                                form={form as any}
                                                initialData={initialData}
                                                canBeSold={form.watch("can_be_sold")}
                                                uoms={uoms}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <ProductManufacturingTab
                                    form={form as any}
                                    initialData={initialData}
                                    products={products}
                                    uoms={uoms}
                                />

                                <ProductInventoryTab
                                    form={form as any}
                                    initialData={initialData}
                                    reorderingRules={reorderingRules}
                                    setReorderingRules={setReorderingRules}
                                    warehouses={warehouses}
                                />

                                <ProductUoMTab
                                    form={form as any}
                                    uoms={uoms}
                                    canBeSold={form.watch("can_be_sold")}
                                    canBePurchased={form.watch("can_be_purchased")}
                                />

                                <ProductPricingTab
                                    initialData={initialData}
                                    pricingRules={pricingRules}
                                    fetchPricingRules={fetchPricingRules}
                                    onOpenRuleDialog={(rule) => {
                                        setSelectedPricingRule(rule || null)
                                        setPricingRuleDialogOpen(true)
                                    }}
                                />
                            </Tabs>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="product-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? 'Guardar Cambios' : 'Crear Producto'}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <PricingRuleForm
                open={pricingRuleDialogOpen}
                onOpenChange={(open) => {
                    setPricingRuleDialogOpen(open)
                    if (!open) setSelectedPricingRule(null)
                }}
                initialData={selectedPricingRule}
                onSuccess={fetchPricingRules}
                productId={initialData?.id}
                productName={initialData?.name}
            />

            <CategoryForm
                open={isCategoryFormOpen}
                onOpenChange={setIsCategoryFormOpen}
                onSuccess={(newCat: any) => {
                    setCategories(prev => [...prev, newCat])
                    form.setValue("category", newCat.id.toString())
                }}
            />
        </Dialog>
    )
}
