"use client"

import { useState, useEffect } from "react"
import { Package, Loader2, AlertCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { productSchema, type ProductFormValues } from "./product/schema"

import { BaseModal } from "@/components/shared/BaseModal"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
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
import { ProductSubscriptionTab } from "./product/ProductSubscriptionTab"
import { ProductVariantsTab } from "./product/ProductVariantsTab"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

// Import dialogs
import { PricingRuleForm } from "./PricingRuleForm"
import { CategoryForm } from "./CategoryForm"

interface ProductFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any
    onSuccess: () => void
    lockedType?: string
    variantMode?: boolean
}

export function ProductForm({ open, onOpenChange, initialData, onSuccess, lockedType, variantMode = false }: ProductFormProps) {
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
    const [variantsRefreshKey, setVariantsRefreshKey] = useState(0)
    const [editingVariant, setEditingVariant] = useState<any>(null)

    // State for Replenishment Rules
    const [reorderingRules, setReorderingRules] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState("general")

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            code: "",
            internal_code: "",
            name: "",
            category: "",
            product_type: lockedType || "STORABLE",
            sale_price: 0,
            is_dynamic_pricing: false,
            uom: "",
            // ...
            // ... (rest of default values)
            sale_uom: "",
            purchase_uom: "",
            allowed_sale_uoms: [],
            receiving_warehouse: "",
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
            has_variants: false,
            parent_template: null,
            attribute_values: [],
            variant_display_name: "",
        },
    })

    // Helper function to map field errors to tabs
    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: number } = {}

        // General tab fields
        const generalFields = ['name', 'category', 'product_type', 'sale_price', 'can_be_sold', 'can_be_purchased', 'sale_uom', 'code']
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
        const uomFields = ['uom', 'purchase_uom', 'allowed_sale_uoms']
        uomFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['uoms'] = (tabErrors['uoms'] || 0) + 1
            }
        })

        // Subscription tab fields
        const subFields = [
            'subscription_supplier', 'subscription_amount', 'recurrence_period',
            'subscription_start_date', 'payment_day_type', 'payment_day',
            'payment_interval_days', 'default_invoice_type', 'income_account'
        ]
        subFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['subscription'] = (tabErrors['subscription'] || 0) + 1
            }
        })

        return tabErrors
    }

    const tabErrors = getTabsWithErrors()

    const productType = form.watch("product_type")

    // Logic for inventory tracking defaults and locking
    useEffect(() => {
        if (productType === "STORABLE") {
            if (!form.getValues("track_inventory")) form.setValue("track_inventory", true)
        } else if (productType === "CONSUMABLE") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false)
            if (form.getValues("can_be_sold")) form.setValue("can_be_sold", false)
        } else if (productType === "SERVICE") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false)
        } else if (productType === "SUBSCRIPTION") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false)
            if (form.getValues("can_be_sold")) form.setValue("can_be_sold", false)
        }

        // Reset dynamic pricing if not manufacturable
        const isManufacturable = productType === 'MANUFACTURABLE' || form.getValues("requires_advanced_manufacturing");
        if (!isManufacturable && form.getValues("is_dynamic_pricing")) {
            form.setValue("is_dynamic_pricing", false);
        }
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
                    is_dynamic_pricing: initialData.is_dynamic_pricing ?? false,
                    uom: initialData.uom?.id?.toString() || initialData.uom?.toString() || "",
                    sale_uom: initialData.sale_uom?.id?.toString() || initialData.sale_uom?.toString() || "",
                    purchase_uom: initialData.purchase_uom?.id?.toString() || initialData.purchase_uom?.toString() || "",
                    allowed_sale_uoms: (initialData.allowed_sale_uoms && initialData.allowed_sale_uoms.length > 0)
                        ? initialData.allowed_sale_uoms.map((u: any) => u.id?.toString() || u.toString())
                        : (initialData.uom ? [(initialData.uom.id || initialData.uom).toString()] : []), // Safeguard: Ensure at least base UoM is allowed
                    receiving_warehouse: initialData.receiving_warehouse?.id?.toString() || initialData.receiving_warehouse?.toString() || "",
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
                    has_variants: initialData.has_variants ?? false,
                    parent_template: initialData.parent_template?.toString() || null,
                    attribute_values: initialData.attribute_values?.map((v: any) => v.toString()) || [],
                    variant_display_name: initialData.variant_display_name || "",
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
                    recurrence_period: initialData.recurrence_period || "MONTHLY",
                    renewal_notice_days: initialData.renewal_notice_days || 30,
                    is_variable_amount: initialData.is_variable_amount ?? false,
                    payment_day_type: initialData.payment_day_type || undefined,
                    payment_day: initialData.payment_day || undefined,
                    payment_interval_days: initialData.payment_interval_days || undefined,
                    default_invoice_type: initialData.default_invoice_type || undefined,
                    subscription_supplier: initialData.subscription_supplier?.id?.toString() || initialData.subscription_supplier?.toString() || "",
                    subscription_amount: initialData.subscription_amount || undefined,
                    subscription_start_date: initialData.subscription_start_date || "",
                    auto_activate_subscription: initialData.auto_activate_subscription ?? true,
                    is_indefinite: initialData.is_indefinite ?? true,
                    contract_end_date: initialData.contract_end_date || "",
                    income_account: initialData.income_account?.id?.toString() || initialData.income_account?.toString() || "",
                    expense_account: initialData.expense_account?.id?.toString() || initialData.expense_account?.toString() || "",
                    preferred_supplier: initialData.preferred_supplier?.id?.toString() || initialData.preferred_supplier?.toString() || "",
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
                    product_type: lockedType || "STORABLE",
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
                    has_variants: false,
                    is_dynamic_pricing: false,
                    parent_template: null,
                    attribute_values: [],
                    variant_display_name: "",
                    income_account: "",
                    expense_account: "",
                    preferred_supplier: "",
                })
                setImagePreview(null)
                setPricingRules([])
                setReorderingRules([])
            }
        }
    }, [open, initialData])

    const FIELD_LABELS: Record<string, string> = {
        name: "Nombre Comercial",
        code: "Código / SKU",
        category: "Categoría",
        product_type: "Tipo de Producto",
        sale_price: "Precio de Venta",
        uom: "Unidad de Medida Stock",
        sale_uom: "Unidad de Medida Venta",
        purchase_uom: "Unidad de Medida Compra",
        receiving_warehouse: "Bodega de Recepción",
        income_account: "Cuenta de Ingresos",
        expense_account: "Cuenta de Gastos",
        subscription_supplier: "Proveedor de Suscripción",
        recurrence_period: "Período de Facturación",
        subscription_amount: "Monto de Suscripción",
        boms: "Lista de Materiales",
        attribute_values: "Valores de Atributos"
    };

    const onSubmitError = (errors: any) => {
        console.log("Form validation errors:", errors)
        const tabsWithErrors = getTabsWithErrors()
        const firstErrorTab = Object.keys(tabsWithErrors)[0]

        // Create list of missing fields
        const missingFields = Object.keys(errors)
            .map(key => FIELD_LABELS[key] || key) // Use mapped name or fallback to key
            .map(label => `• ${label}`)
            .join("\n")

        if (firstErrorTab) {
            setActiveTab(firstErrorTab)
            toast.error("Formulario incompleto", {
                description: (
                    <div className="flex flex-col gap-1">
                        <span>Por favor complete los siguientes campos:</span>
                        <pre className="mt-2 font-sans text-xs text-muted-foreground whitespace-pre-wrap">
                            {missingFields}
                        </pre>
                    </div>
                ),
                duration: 5000,
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
            formData.append('is_dynamic_pricing', data.is_dynamic_pricing ? 'true' : 'false')
            formData.append('uom', data.uom || '')
            formData.append('sale_uom', data.sale_uom || '')
            if (data.purchase_uom) formData.append('purchase_uom', data.purchase_uom)
            if (data.receiving_warehouse) formData.append('receiving_warehouse', data.receiving_warehouse)
            if (data.income_account) formData.append('income_account', data.income_account)
            if (data.expense_account) formData.append('expense_account', data.expense_account)
            if (data.preferred_supplier) formData.append('preferred_supplier', data.preferred_supplier)

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
            formData.append('has_variants', data.has_variants ? 'true' : 'false')
            if (data.parent_template) formData.append('parent_template', data.parent_template)
            if (data.variant_display_name) formData.append('variant_display_name', data.variant_display_name)
            if (data.attribute_values && data.attribute_values.length > 0) {
                data.attribute_values.forEach(v => formData.append('attribute_values', v))
            }

            if (!initialData && data.boms && data.boms.length > 0) {
                formData.append('boms', JSON.stringify(data.boms))
            }
            if (data.product_custom_fields && data.product_custom_fields.length > 0) {
                formData.append('product_custom_fields', JSON.stringify(data.product_custom_fields))
            }

            // Append Subscription fields
            if (data.product_type === 'SUBSCRIPTION') {
                formData.append('recurrence_period', data.recurrence_period || 'MONTHLY')
                formData.append('renewal_notice_days', (data.renewal_notice_days || 30).toString())
                formData.append('is_variable_amount', data.is_variable_amount ? 'true' : 'false')

                // Payment Configuration
                if (data.payment_day_type) formData.append('payment_day_type', data.payment_day_type)
                if (data.payment_day) formData.append('payment_day', data.payment_day.toString())
                if (data.payment_interval_days) formData.append('payment_interval_days', data.payment_interval_days.toString())

                // Invoice Configuration
                if (data.default_invoice_type) formData.append('default_invoice_type', data.default_invoice_type)

                // Direct Activation
                if (data.subscription_supplier) formData.append('subscription_supplier', data.subscription_supplier)
                if (data.subscription_amount !== undefined && data.subscription_amount !== null) formData.append('subscription_amount', data.subscription_amount.toString())
                if (data.subscription_start_date) formData.append('subscription_start_date', data.subscription_start_date)
                formData.append('auto_activate_subscription', data.auto_activate_subscription ? 'true' : 'false')

                // Contract Duration
                formData.append('is_indefinite', data.is_indefinite ? 'true' : 'false')
                if (data.contract_end_date) formData.append('contract_end_date', data.contract_end_date)
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

    // Simplified Render for Variant Mode
    if (variantMode) {
        return (
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={`Editar Variante: ${initialData?.name || initialData?.internal_code || 'Nueva'}`}
                size="lg"
                description="Gestión de variante"
                className="max-w-[95vw] h-[90vh]"
            >
                <div className="flex h-full">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-6">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/20 p-1">
                                        <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                            Información General
                                        </TabsTrigger>
                                        <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                            Reglas de Precios
                                        </TabsTrigger>
                                        <TabsTrigger value="manufacturing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                            Fabricación
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="general" className="mt-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4 md:col-span-2">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="md:col-span-1">
                                                        <div className="aspect-square w-full">
                                                            <ProductImageUpload form={form} imagePreview={imagePreview} setImagePreview={setImagePreview} />
                                                        </div>
                                                    </div>
                                                    <div className="md:col-span-2 space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <FormField<ProductFormValues>
                                                                control={form.control}
                                                                name="internal_code"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Código Interno</FormLabel>
                                                                        <FormControl>
                                                                            <Input {...field} readOnly className="bg-muted" />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField<ProductFormValues>
                                                                control={form.control}
                                                                name="name"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>Nombre Comercial</FormLabel>
                                                                        <FormControl>
                                                                            <Input {...field} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2">
                                                <ProductPricingSection
                                                    form={form as any}
                                                    initialData={initialData}
                                                    canBeSold={true}
                                                    uoms={uoms}
                                                    forceEdit={true}
                                                />
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="pricing" className="mt-6">
                                        <ProductPricingTab
                                            initialData={initialData}
                                            pricingRules={pricingRules}
                                            fetchPricingRules={fetchPricingRules}
                                            onOpenRuleDialog={(rule) => {
                                                setSelectedPricingRule(rule || null)
                                                setPricingRuleDialogOpen(true)
                                            }}
                                        />
                                    </TabsContent>

                                    <ProductManufacturingTab
                                        form={form as any}
                                        initialData={initialData}
                                        products={products}
                                        uoms={uoms}
                                        variantMode={true}
                                    />
                                </Tabs>

                                <div className="flex justify-end gap-4 pt-4 border-t">
                                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar Cambios"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>

                    {/* Activity Sidebar */}
                    {initialData && (
                        <div className="w-80 border-l bg-muted/5 h-full flex flex-col overflow-hidden">
                            <ActivitySidebar
                                entityId={initialData.id}
                                entityType="product"
                            />
                        </div>
                    )}
                </div>

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
            </BaseModal>
        )
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            hideScrollArea
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-2">
                    <Package className="h-6 w-6 text-primary" />
                    {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                </div>
            }
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="product-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? 'Guardar Cambios' : 'Crear Producto'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Main content area */}
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
                                    {['STORABLE', 'MANUFACTURABLE'].includes(form.watch("product_type")) && (
                                        <TabsTrigger value="inventory" className="px-8 flex gap-2">
                                            Inventario
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="uoms" className="px-8 flex gap-2 relative">
                                        Und. de Medida
                                        {tabErrors['uoms'] && (
                                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                                <AlertCircle className="h-3 w-3" />
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    {form.watch("product_type") === 'SUBSCRIPTION' && (
                                        <TabsTrigger value="subscription" className="px-8 flex gap-2 relative">
                                            Suscripción
                                            {tabErrors['subscription'] && (
                                                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                                    <AlertCircle className="h-3 w-3" />
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    )}
                                    {form.watch("can_be_sold") && (
                                        <TabsTrigger value="pricing" className="px-8 flex gap-2">
                                            Reglas de Precios
                                        </TabsTrigger>
                                    )}

                                    {form.watch("has_variants") && (
                                        <TabsTrigger value="variants" className="px-8 flex gap-2">
                                            Variantes
                                        </TabsTrigger>
                                    )}
                                </TabsList>

                                <TabsContent value="general" className="mt-0 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        <div className="md:col-span-3 space-y-6 border-r pr-8">
                                            <ProductTypeSelector form={form as any} disabled={!!initialData} lockedType={lockedType} />
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

                                <ProductVariantsTab
                                    key={variantsRefreshKey}
                                    form={form as any}
                                    initialData={initialData}
                                    onEditVariant={(variant) => setEditingVariant(variant)}
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

                                <TabsContent value="subscription" className="mt-0">
                                    <ProductSubscriptionTab form={form} isEditing={!!initialData} />
                                </TabsContent>

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

                {/* Activity Sidebar */}
                {initialData && (
                    <div className="w-80 border-l bg-muted/5 h-full flex flex-col overflow-hidden">
                        <ActivitySidebar
                            entityId={initialData.id}
                            entityType="product"
                        />
                    </div>
                )}
            </div>

            {/* Nested Product Form for Variant Editing */}
            {editingVariant && (
                <ProductForm
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) setEditingVariant(null)
                    }}
                    initialData={editingVariant}
                    onSuccess={() => {
                        setVariantsRefreshKey(prev => prev + 1)
                        setEditingVariant(null)
                    }}
                    lockedType={editingVariant.product_type}
                    variantMode={true} // Enable simplified mode
                />
            )}

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
        </BaseModal>
    )
}
