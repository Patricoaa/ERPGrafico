"use client"

import { useState, useEffect } from "react"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import { 
    Sheet, 
    SheetHeader, 
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { ProductInitialData } from "@/types/forms"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { productSchema, type ProductFormValues } from "./product/schema"
import { ShoppingCart, Package, Wand2, User, Banknote, Scale, Truck, Receipt, ClipboardList, LayoutDashboard, Calendar, ArrowRight, Layers, Factory, AlertCircle, Loader2 } from "lucide-react"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

// Import modular components
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
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"

interface ProductFormProps {
    auditSidebar?: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: ProductInitialData
    onSuccess: () => void
    lockedType?: string
    variantMode?: boolean
}

export function ProductForm({ auditSidebar,  open, onOpenChange, initialData, onSuccess, lockedType, variantMode = false }: ProductFormProps) {
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
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

    // UI UX Pro Max: Track initial load for advanced skeletons
    const [isFetchingInitialData, setIsFetchingInitialData] = useState(false)

    const [activeTab, setActiveTab] = useState("general")

    const { isSheetCollapsed } = useGlobalModals()

    const windowWidth = useWindowWidth(150, open)

    const handleOpenChangeProxy = (newOpen: boolean) => {
        if (!newOpen && Object.keys(form.formState.dirtyFields).length > 0) {
            setConfirmCloseOpen(true)
            return
        }
        if (newOpen && isSheetCollapsed("PRODUCT_DETAIL")) {
            // Jump behavior: Hub was closed here previously
        }
        onOpenChange(newOpen)
    }

    const handleConfirmClose = () => {
        setConfirmCloseOpen(false)
        onOpenChange(false)
    }

    const fullWidth = Math.min(windowWidth * 0.95, 1800) // Match the 95vw logic

    const form = useForm<ProductFormValues>({
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
                initOperations.push(fetchPricingRules() as any)
            }

            Promise.all(initOperations).finally(() => {
                setIsFetchingInitialData(false)
            });

            if (initialData) {
                const getId = (val: any) => {
                    if (val == null) return ""
                    if (typeof val === "object" && "id" in val) return val.id.toString()
                    return val.toString()
                }

                form.reset({
                    code: initialData.code || "",
                    internal_code: initialData.internal_code || "",
                    name: initialData.name || "",
                    category: getId(initialData.category),
                    product_type: initialData.product_type || "STORABLE",
                    sale_price: Number(initialData.sale_price) || 0,
                    sale_price_gross: Number(initialData.sale_price_gross) || 0,
                    is_dynamic_pricing: initialData.is_dynamic_pricing ?? false,
                    uom: getId(initialData.uom),
                    sale_uom: getId(initialData.sale_uom),
                    purchase_uom: getId(initialData.purchase_uom),
                    allowed_sale_uoms: (initialData.allowed_sale_uoms && initialData.allowed_sale_uoms.length > 0)
                        ? initialData.allowed_sale_uoms.map((u: any) => getId(u))
                        : (initialData.uom ? [getId(initialData.uom)] : []), // Safeguard: Ensure at least base UoM is allowed
                    receiving_warehouse: getId(initialData.receiving_warehouse),
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
            const errorData = (error as any).response?.data

            let errorMessage = "No se pudo guardar el producto."

            if (errorData) {
                if (typeof errorData === 'object') {
                    // Recursive function to extract all error messages
                    const extractErrors = (obj: any, prefix = ''): string[] => {
                        let messages: string[] = []
                        for (const [key, value] of Object.entries(obj)) {
                            const label = FIELD_LABELS[key] || key
                            const currentPrefix = prefix ? `${prefix} -> ${label}` : label

                            if (Array.isArray(value)) {
                                messages.push(`${currentPrefix}: ${value.join(', ')}`)
                            } else if (typeof value === 'object' && value !== null) {
                                messages = [...messages, ...extractErrors(value, currentPrefix)]
                            } else {
                                messages.push(`${currentPrefix}: ${value}`)
                            }
                        }
                        return messages
                    }

                    const allErrors = extractErrors(errorData)
                    if (allErrors.length > 0) {
                        errorMessage = allErrors.join('\n')
                    }
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData
                }
            }

            toast.error("Error al guardar", {
                description: (
                    <pre className="mt-2 font-sans text-[10px] text-destructive-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {errorMessage}
                    </pre>
                ),
                duration: 10000,
            })
        } finally {
            setLoading(false)
        }
    }

    const formContent = (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b bg-muted/5">
                <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
                    <TabsTrigger
                        value="general"
                        className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                    >
                        <Package className="h-4 w-4" />
                        Información General
                        {tabErrors['general'] && (
                            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-black">!</span>
                        )}
                    </TabsTrigger>

                    {(form.watch("product_type") === 'MANUFACTURABLE' || form.watch("has_bom")) && (
                        <TabsTrigger
                            value="manufacturing"
                            className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                        >
                            <Factory className="h-4 w-4" />
                            Fabricación
                        </TabsTrigger>
                    )}

                    {['STORABLE', 'MANUFACTURABLE'].includes(form.watch("product_type")) && (
                        <TabsTrigger
                            value="logistics"
                            className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                        >
                            <Truck className="h-4 w-4" />
                            Logística
                        </TabsTrigger>
                    )}

                    {form.watch("product_type") === 'SUBSCRIPTION' && (
                        <TabsTrigger
                            value="commercial"
                            className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            Comercial
                        </TabsTrigger>
                    )}

                    {form.watch("can_be_sold") && form.watch("product_type") !== 'SUBSCRIPTION' && (
                        <TabsTrigger
                            value="pricing"
                            className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                        >
                            <Scale className="h-4 w-4" />
                            Reglas
                        </TabsTrigger>
                    )}

                    {form.watch("has_variants") && !variantMode && (
                        <TabsTrigger
                            value="variants"
                            className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2 h-12 text-[11px] uppercase tracking-wider"
                        >
                            <Layers className="h-4 w-4" />
                            Variantes
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {isFetchingInitialData ? (
                        <div className="p-6 space-y-8 animate-in fade-in duration-500">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-10 w-48 rounded-[0.25rem]" />
                                <Skeleton className="h-10 w-32 rounded-[0.25rem]" />
                                <Skeleton className="h-10 w-32 rounded-[0.25rem]" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-3 space-y-4">
                                    <Skeleton className="h-[250px] w-full rounded-[0.25rem]" />
                                    <Skeleton className="h-32 w-full rounded-[0.25rem]" />
                                </div>
                                <div className="md:col-span-9 space-y-4">
                                    <Skeleton className="h-16 w-full rounded-[0.25rem]" />
                                    <Skeleton className="h-40 w-full rounded-[0.25rem]" />
                                    <Skeleton className="h-64 w-full rounded-[0.25rem]" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form id="product-form" onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="space-y-4 pt-6 px-4 mx-auto pb-32">
                                <fieldset disabled={loading} className="group min-w-0 transition-opacity group-disabled:opacity-75">
                                    <TabsContent value="general" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                    <div className="md:col-span-3 space-y-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 pt-2 pb-2">
                                                <div className="flex-1 h-px bg-border" />
                                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">Imagen</span>
                                                <div className="flex-1 h-px bg-border" />
                                            </div>
                                            <ProductImageUpload
                                                form={form as any}
                                                imagePreview={imagePreview}
                                                setImagePreview={setImagePreview}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 pt-2 pb-2">
                                                <div className="flex-1 h-px bg-border" />
                                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">Tipo de producto</span>
                                                <div className="flex-1 h-px bg-border" />
                                            </div>
                                            <ProductTypeSelector form={form as any} disabled={!!initialData} lockedType={lockedType} />
                                        </div>
                                    </div>

                                    <div className="md:col-span-9 space-y-4">
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

                            { (form.watch("product_type") === 'MANUFACTURABLE' || form.watch("has_bom")) && (
                                <ProductManufacturingTab
                                    form={form as any}
                                    initialData={initialData}
                                    products={products}
                                    uoms={uoms}
                                    variantMode={variantMode}
                                />
                            )}

                            { form.watch("has_variants") && !variantMode && (
                                <ProductVariantsTab
                                    key={variantsRefreshKey}
                                    form={form as any}
                                    initialData={initialData}
                                    onTabChange={(tab: string) => setActiveTab(tab)}
                                />
                            )}

                            { ['STORABLE', 'MANUFACTURABLE'].includes(form.watch("product_type")) && (
                                <ProductInventoryTab
                                    form={form as any}
                                    initialData={initialData}
                                    warehouses={warehouses}
                                    uoms={uoms}
                                />
                            )}

                            { form.watch("product_type") === 'SUBSCRIPTION' && (
                                <TabsContent value="commercial" className="mt-0 animate-in fade-in duration-300">
                                    <ProductSubscriptionTab form={form} isEditing={!!initialData} />
                                </TabsContent>
                            )}

                                { form.watch("can_be_sold") && form.watch("product_type") !== 'SUBSCRIPTION' && (
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
                        </Form>
                    )}
                </div>

                {/* Activity Sidebar */}
                {initialData?.id && (
                    <div className="w-72 border-l bg-muted/5 h-full flex flex-col overflow-hidden hidden lg:flex">
                        {auditSidebar}
                    </div>
                )}
            </div>

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
        </Tabs>
    )

    return (
        <CollapsibleSheet
            sheetId="PRODUCT_DETAIL"
            open={open}
            onOpenChange={handleOpenChangeProxy}
            tabLabel="FICHA PRODUCTO"
            tabIcon={Package}
            size="xl"
            className="max-w-[95vw] w-[95vw]"
        >
                <SheetHeader className="p-6 pb-4 border-b bg-background sticky top-0 z-50 shrink-0">
                    <div className="flex items-center justify-between w-full pr-12 text-left">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg text-primary shadow-sm border border-primary/5 hidden sm:block">
                                <Package className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3">
                                    <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                                        Ficha de Producto
                                    </SheetTitle>
                                    <span className="bg-muted/10 text-muted-foreground border border-muted-foreground/20 px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-wider h-5 flex items-center">
                                        {initialData?.internal_code || "Nuevo"}
                                    </span>
                                </div>
                                <SheetDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                    {initialData?.name || form.watch("name") || 'Nuevo Producto'} • {variantMode ? "Edición de Variante" : "Configuración Maestra"}
                                </SheetDescription>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                {/* Standardized Close Button */}
                <SheetCloseButton onClick={() => onOpenChange(false)} />

                <div className="flex-1 overflow-hidden flex flex-col">
                    {formContent}
                </div>

                <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40 bg-background/80 backdrop-blur-md sticky bottom-0 z-50 mt-auto shrink-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5"
                    >
                        Cancelar
                    </Button>
                    <Button
                        form="product-form"
                        type="submit"
                        disabled={loading}
                        className="rounded-lg text-xs font-bold"
                    >
                        {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        {initialData ? 'Guardar Cambios' : 'Crear Producto'}
                    </Button>
                </div>
        </CollapsibleSheet>
    )
}
