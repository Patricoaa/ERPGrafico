"use client"

import { ProductCategory, UoM, Warehouse, Product } from "@/types/entities"

import { useState, useEffect } from "react"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import { BaseModal } from "@/components/shared/BaseModal"
import { useForm, FieldErrors, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api, { resolveMediaUrl } from "@/lib/api"
import { ShoppingCart, Package, Scale, Truck, Layers, Factory, Loader2 } from "lucide-react"
import { showApiError } from "@/lib/errors"
import { Form } from "@/components/ui/form"

import { FormSkeleton, FormSection, FormFooter, FormSplitLayout, FormTabs, FormTabsContent, type FormTabItem } from "@/components/shared"

// Import modular components
import { productSchema, type ProductFormValues } from "./product/schema"
import { ProductTypeSelector } from "./product/ProductTypeSelector"
import { ProductImageUpload } from "./product/ProductImageUpload"
import { ProductBasicInfo } from "./product/ProductBasicInfo"
import { ProductPricingSection } from "./product/ProductPricingSection"
import { ProductInventoryTab } from "./product/ProductInventoryTab"
import { ProductManufacturingTab } from "./product/ProductManufacturingTab"
import { ProductPricingTab } from "./product/ProductPricingTab"
import { ProductSubscriptionTab } from "./product/ProductSubscriptionTab"
import { ProductVariantsTab } from "./product/ProductVariantsTab"
// Removed Badge import for governance compliance

// Import dialogs
import { PricingRuleForm } from "@/features/sales/components/PricingRuleForm"
import { CategoryForm } from "./CategoryForm"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { CancelButton, SubmitButton } from "@/components/shared"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface ProductFormProps {
    sidebar?: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any // Bridging discrepancies between local/global Product and ProductInitialData
    onSuccess: () => void
    lockedType?: string
    variantMode?: boolean
}

export function ProductForm({ sidebar, open, onOpenChange, initialData, onSuccess, lockedType, variantMode = false }: ProductFormProps) {
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<ProductCategory[]>([])
    const [uoms, setUoms] = useState<UoM[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
    const [products, setProducts] = useState<Product[]>([])
    const [pricingRules, setPricingRules] = useState<any[]>([])
    const [selectedPricingRule, setSelectedPricingRule] = useState<any | null>(null)
    const [pricingRuleDialogOpen, setPricingRuleDialogOpen] = useState(false)
    const [variantsRefreshKey, setVariantsRefreshKey] = useState(0)
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

    // UI UX Pro Max: Track initial load for advanced skeletons
    const [isFetchingInitialData, setIsFetchingInitialData] = useState(false)

    const [activeTab, setActiveTab] = useState("general")

    const form: UseFormReturn<ProductFormValues> = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            code: "",
            internal_code: "",
            name: "",
            category: "",
            product_type: lockedType || "STORABLE",
            sale_price: 0,
            sale_price_gross: 0,
            is_dynamic_pricing: false,
            uom: "",
            // ...
            // ... (rest of default values)
            sale_uom: "",
            purchase_uom: "",
            allowed_sale_uoms: [],
            receiving_warehouse: "",
            track_inventory: true,
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

        // Manufacturable products cannot be purchased (business rule)
        if (productType === "MANUFACTURABLE") {
            if (form.getValues("can_be_purchased")) {
                form.setValue("can_be_purchased", false);
            }
        }
    }, [productType, form])

    // Validate activeTab when relevant product settings change
    const hasBom = form.watch("has_bom")
    const canBeSold = form.watch("can_be_sold")
    const hasVariants = form.watch("has_variants")

    useEffect(() => {
        const isTabValid = (tab: string): boolean => {
            switch (tab) {
                case "general": return true
                case "manufacturing": return productType === 'MANUFACTURABLE' || hasBom
                case "logistics": return ['STORABLE', 'MANUFACTURABLE'].includes(productType)
                case "commercial": return productType === 'SUBSCRIPTION'
                case "pricing": return canBeSold && productType !== 'SUBSCRIPTION'
                case "variants": return hasVariants && !variantMode
                default: return false
            }
        }

        if (!isTabValid(activeTab)) {
            setActiveTab("general")
        }
    }, [productType, hasBom, canBeSold, hasVariants, activeTab, variantMode])

    // Synchronize allowed_sale_uoms with base UoM and filter incompatible units
    const stockUomId = form.watch("uom")
    useEffect(() => {
        if (!stockUomId) return

        const currentAllowed = form.getValues("allowed_sale_uoms") || []
        const currentSaleUom = form.getValues("sale_uom")
        const stockUom = uoms.find(u => u.id.toString() === stockUomId.toString())

        if (!stockUom) return

        // 1. Filter out UoMs that are not in the same category
        const filteredAllowed = currentAllowed.filter(id => {
            const u = uoms.find(uom => uom.id.toString() === id.toString())
            return u?.category === stockUom.category
        })

        // 2. Ensure stock UoM is always in allowed_sale_uoms
        if (!filteredAllowed.includes(stockUomId.toString())) {
            filteredAllowed.push(stockUomId.toString())
        }

        // 3. Update if changed
        if (JSON.stringify(filteredAllowed.sort()) !== JSON.stringify(currentAllowed.sort())) {
            form.setValue("allowed_sale_uoms", filteredAllowed)
        }

        // 4. Default sale_uom to base if not set or no longer allowed
        if (!currentSaleUom || !filteredAllowed.includes(currentSaleUom.toString())) {
            form.setValue("sale_uom", stockUomId.toString())
        }
    }, [stockUomId, uoms, form])

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
            setIsFetchingInitialData(true)

            const initOperations = [
                fetchCategories(),
                fetchUoMs(),
                fetchProducts(),
                fetchWarehouses()
            ];

            if (initialData?.id) {
                initOperations.push(fetchPricingRules())
            }

            Promise.all(initOperations).finally(() => {
                setIsFetchingInitialData(false)
            });

            if (initialData) {
                const getId = (val: unknown): string => {
                    if (val == null) return ""
                    if (typeof val === "object" && val !== null && "id" in val) return String((val as { id: unknown }).id)
                    return String(val)
                }

                form.reset({
                    code: initialData.code || "",
                    internal_code: initialData.internal_code || "",
                    name: initialData.name || "",
                    category: typeof initialData.category === 'object' ? String((initialData.category as any)?.id) : String(initialData.category || ""),
                    product_type: initialData.product_type || "STORABLE",
                    sale_price: Number(initialData.sale_price) || 0,
                    sale_price_gross: Number(initialData.sale_price_gross) || 0,
                    is_dynamic_pricing: initialData.is_dynamic_pricing ?? false,
                    uom: typeof initialData.uom === 'object' ? String((initialData.uom as any)?.id) : String(initialData.uom || ""),
                    sale_uom: typeof initialData.sale_uom === 'object' ? String((initialData.sale_uom as any)?.id) : String(initialData.sale_uom || initialData.uom || ""),
                    purchase_uom: typeof initialData.purchase_uom === 'object' ? String((initialData.purchase_uom as any)?.id) : String(initialData.purchase_uom || initialData.uom || ""),
                    allowed_sale_uoms: (initialData.allowed_sale_uoms && initialData.allowed_sale_uoms.length > 0)
                        ? initialData.allowed_sale_uoms.map((u: any) => typeof u === 'object' ? String(u.id) : String(u))
                        : (initialData.uom ? [getId(initialData.uom)] : []),
                    receiving_warehouse: typeof initialData.receiving_warehouse === 'object' ? String((initialData.receiving_warehouse as any)?.id) : String(initialData.receiving_warehouse || ""),
                    track_inventory: initialData.track_inventory ?? true,
                    can_be_sold: initialData.can_be_sold ?? true,
                    can_be_purchased: initialData.can_be_purchased ?? true,
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
                    attribute_values: initialData.attribute_values?.map((v: unknown) => String(v)) || [],
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
                    product_custom_fields: initialData.product_custom_fields?.map((f: any) => ({
                        template: f.template,
                        order: f.order || 0
                    })) || [],
                    recurrence_period: initialData.recurrence_period || "MONTHLY",
                    renewal_notice_days: initialData.renewal_notice_days || 30,
                    is_variable_amount: initialData.is_variable_amount ?? false,
                    payment_day_type: initialData.payment_day_type || undefined,
                    payment_day: initialData.payment_day || undefined,
                    payment_interval_days: initialData.payment_interval_days || undefined,
                    default_invoice_type: initialData.default_invoice_type || undefined,
                    subscription_supplier: typeof initialData.subscription_supplier === 'object' ? String((initialData.subscription_supplier as any)?.id) : String(initialData.subscription_supplier || ""),
                    subscription_amount: initialData.subscription_amount || undefined,
                    subscription_start_date: initialData.subscription_start_date || "",
                    auto_activate_subscription: initialData.auto_activate_subscription ?? true,
                    is_indefinite: initialData.is_indefinite ?? true,
                    contract_end_date: initialData.contract_end_date || "",
                    income_account: typeof initialData.income_account === 'object' ? String((initialData.income_account as any)?.id) : String(initialData.income_account || ""),
                    expense_account: typeof initialData.expense_account === 'object' ? String((initialData.expense_account as any)?.id) : String(initialData.expense_account || ""),
                    preferred_supplier: typeof initialData.preferred_supplier === 'object' ? String((initialData.preferred_supplier as any)?.id) : String(initialData.preferred_supplier || ""),
                })
                setImagePreview(resolveMediaUrl(initialData.image) || null)
            } else {
                form.reset({
                    code: "",
                    internal_code: "",
                    name: "",
                    category: "",
                    product_type: lockedType || "STORABLE",
                    sale_price: 0,
                    sale_price_gross: 0,
                    uom: "",
                    sale_uom: "",
                    purchase_uom: "",
                    allowed_sale_uoms: [],
                    track_inventory: true,
                    can_be_sold: true,
                    can_be_purchased: true,
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

    const onSubmitError = (errors: FieldErrors<ProductFormValues>) => {
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
            if (data.variant_updates && data.variant_updates.length > 0) {
                formData.append('variant_updates', JSON.stringify(data.variant_updates))
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
                const res = await api.post('/inventory/products/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Producto creado")
                // If it has variants, we don't close the modal, instead we "promote" it to edit mode
                if (data.has_variants) {
                    onSuccess() // Refresh list in background
                    // Re-fetch or use response to update initialData in parent is tricky
                    // But we can just call onSuccess and maybe NOT close?
                    // The safest is to signal the parent to re-open this product or just keep it active.
                    // However, we don't have the new product ID easily here unless we reload.
                    // Let's at least allow the user to stay if they want to generate combos.
                    // But without initialData, the tabs might still be restricted.
                    // Let's just close as usual for now BUT ensure validation doesn't block them.
                    // WAIT: If I don't close, the user can generate? NO, they need the ID.
                    // Let's stick to the validation fix first, it's the biggest blocker.
                }
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Error saving product", error)
            showApiError(error, "No se pudo guardar el producto.")
        } finally {
            setLoading(false)
        }
    }

    const tabItems: FormTabItem[] = [
        {
            value: "general",
            label: "General",
            icon: Package,
            hasErrors: !!tabErrors['general'],
        },
        {
            value: "manufacturing",
            label: "Fabricación",
            icon: Factory,
            hidden: !(productType === 'MANUFACTURABLE' || hasBom),
            hasErrors: !!tabErrors['manufacturing'],
        },
        {
            value: "logistics",
            label: "Logística",
            icon: Truck,
            hidden: !['STORABLE', 'MANUFACTURABLE'].includes(productType),
            hasErrors: !!tabErrors['logistics'],
        },
        {
            value: "commercial",
            label: "Comercial",
            icon: ShoppingCart,
            hidden: productType !== 'SUBSCRIPTION',
            hasErrors: !!tabErrors['commercial'],
        },
        {
            value: "pricing",
            label: "Reglas",
            icon: Scale,
            hidden: !canBeSold || productType === 'SUBSCRIPTION',
            hasErrors: !!tabErrors['pricing'],
        },
        {
            value: "variants",
            label: "Variantes",
            icon: Layers,
            hidden: !hasVariants || variantMode,
            hasErrors: !!tabErrors['variants'],
        },
    ]

    const headerSlot = (
        <div className="flex flex-col p-6 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <Package className="h-6 w-6 text-primary" />
                {initialData ? 'Editar Producto' : 'Nuevo Producto'}
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                Ficha Maestra <span className="opacity-30">|</span> Gestión de Inventario
            </div>
        </div>
    )

    const footerSlot = (
        <FormFooter 
            actions={
                <SubmitButton form="product-form" loading={form.formState.isSubmitting}>
                    {initialData ? "Guardar Cambios" : "Crear Producto"}
                </SubmitButton>
            }
            leftActions={
                <CancelButton onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting} />
            }
        />
    )

    const formContent = (
        <FormTabs
            items={tabItems}
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="vertical"
            header={headerSlot}
        >
            {isFetchingInitialData ? (
                <div className="p-6 flex-1">
                    <FormSkeleton hasTabs tabs={6} cards={2} fields={5} />
                </div>
            ) : (
                <Form {...form}>
                    <FormSplitLayout
                        sidebar={sidebar}
                        showSidebar={!!initialData?.id}
                        className="px-0 pt-0 pb-0" // FormTabs already handles some padding
                    >
                        <form id="product-form" onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-8 pt-6 px-6 mx-auto pb-12">
                            <fieldset disabled={loading} className="group min-w-0 transition-opacity group-disabled:opacity-75">
                                <FormTabsContent value="general" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        <div className="md:col-span-3 space-y-8">
                                            <div className="space-y-6">
                                                <FormSection title="Imagen" icon={Package} />
                                                <ProductImageUpload
                                                    form={form}
                                                    imagePreview={imagePreview}
                                                    setImagePreview={setImagePreview}
                                                />
                                            </div>

                                            <div className="space-y-6">
                                                <FormSection title="Tipo de producto" icon={Layers} />
                                                <ProductTypeSelector form={form} disabled={!!initialData} lockedType={lockedType} />
                                            </div>
                                        </div>

                                        <div className="md:col-span-9 space-y-4">
                                            <ProductBasicInfo
                                                form={form}
                                                categories={categories}
                                                isEditing={!!initialData}
                                                onAddCategory={() => setIsCategoryFormOpen(true)}
                                            />

                                            <ProductPricingSection
                                                form={form}
                                                initialData={initialData}
                                                canBeSold={form.watch("can_be_sold")}
                                                uoms={uoms}
                                            />
                                        </div>
                                    </div>
                                </FormTabsContent>

                                {(form.watch("product_type") === 'MANUFACTURABLE' || form.watch("has_bom")) && (
                                    <ProductManufacturingTab
                                        form={form}
                                        initialData={initialData}
                                        products={products}
                                        uoms={uoms}
                                        variantMode={variantMode}
                                    />
                                )}

                                {form.watch("has_variants") && !variantMode && (
                                    <ProductVariantsTab
                                        key={variantsRefreshKey}
                                        form={form}
                                        initialData={initialData}
                                        onTabChange={(tab: string) => setActiveTab(tab)}
                                    />
                                )}

                                {['STORABLE', 'MANUFACTURABLE'].includes(form.watch("product_type")) && (
                                    <ProductInventoryTab
                                        form={form}
                                        initialData={initialData}
                                        warehouses={warehouses}
                                        uoms={uoms}
                                    />
                                )}

                                {form.watch("product_type") === 'SUBSCRIPTION' && (
                                    <FormTabsContent value="commercial" className="mt-0 animate-in fade-in duration-300">
                                        <ProductSubscriptionTab form={form} isEditing={!!initialData} />
                                    </FormTabsContent>
                                )}

                                {form.watch("can_be_sold") && form.watch("product_type") !== 'SUBSCRIPTION' && (
                                    <ProductPricingTab
                                        initialData={initialData}
                                        pricingRules={pricingRules}
                                        fetchPricingRules={fetchPricingRules}
                                        onOpenRuleDialog={(rule) => {
                                            setSelectedPricingRule(rule || null)
                                            setPricingRuleDialogOpen(true)
                                        }}
                                    />
                                )}
                            </fieldset>
                        </form>
                    </FormSplitLayout>
                </Form>
            )}

            {/* Nested Modals */}
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
                onSuccess={(newCategory) => {
                    setCategories(prev => [...prev, newCategory])
                    form.setValue("category", newCategory.id.toString())
                }}
            />
        </FormTabs>
    )

    return (
        <BaseModal
            title={initialData ? "Editar Producto" : "Nuevo Producto"}
            open={open}
            onOpenChange={(newOpen) => {
                if (!newOpen && Object.keys(form.formState.dirtyFields).length > 0) {
                    setConfirmCloseOpen(true)
                    return
                }
                onOpenChange(newOpen)
            }}
            size="2xl"
            className="h-[90vh]"
            headerClassName="sr-only"
            hideScrollArea={true}
            allowOverflow={true}
            contentClassName="p-0"
            footer={footerSlot}
        >
            {formContent}
            
            {/* ActionConfirmModal for closing with unsaved changes */}
            <ActionConfirmModal
                open={confirmCloseOpen}
                onOpenChange={setConfirmCloseOpen}
                title="Descartar cambios"
                description="Hay cambios sin guardar. ¿Está seguro que desea cerrar y perder los cambios?"
                variant="destructive"
                confirmText="Descartar y Cerrar"
                onConfirm={() => {
                    setConfirmCloseOpen(false)
                    onOpenChange(false)
                }}
            />
        </BaseModal>
    )
}
