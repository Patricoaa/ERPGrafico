"use client"

import {UoM, Product} from "@/types/entities"

import { useState, useEffect, useMemo, useRef } from "react"
import { useForm, FieldErrors, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { resolveMediaUrl } from "../api/inventoryApi"
import { useProducts } from "../hooks/useProducts"
import { useUoMs } from "../hooks/useUoMs"
import { useWarehouses } from "../hooks/useWarehouses"
import { useProductPricingRules } from "../hooks/usePricingRules"
import {ShoppingCart, Package, Truck, Layers, Factory, DollarSign, Printer} from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { showApiError } from "@/lib/errors"
import { Form } from "@/components/ui/form"

import {ActionConfirmModal, Drawer, FormFooter, FormSplitLayout, UnderlineTabs, UnderlineTabsContent, SkeletonShell, type TabItem} from '@/components/shared'
import { ActivitySidebar } from "@/features/audit/components"
// Removed Badge import for governance compliance

// Import dialogs
import { Button } from "@/components/ui/button"
import { PricingRuleDrawer } from "@/features/sales/components/PricingRuleDrawer"
import { CancelButton, ActionSlideButton } from "@/components/shared"

import { formDrawerWidth } from "@/lib/form-widths"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"

// Product subcomponents and schema
import { ProductBasicInfo } from "./product/ProductBasicInfo"
import { ProductManufacturingTab } from "./product/ProductManufacturingTab"
import { ProductVariantsTab } from "./product/ProductVariantsTab"
import { ProductInventoryTab } from "./product/ProductInventoryTab"
import { ProductSubscriptionTab } from "./product/ProductSubscriptionTab"
import { ProductPricingSection } from "./product/ProductPricingSection"
import { ProductPricingTab } from "./product/ProductPricingTab"
import { productSchema, type ProductFormValues } from "./product/schema"

interface ProductDrawerProps {
    sidebar?: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any // Bridging discrepancies between local/global Product and ProductInitialData
    onSuccess: () => void
    lockedType?: string
    variantMode?: boolean
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
}

export function ProductDrawer({ sidebar, open, onOpenChange, initialData, onSuccess, lockedType, variantMode = false, inline = false, onLoadingChange, mode: modeProp }: ProductDrawerProps) {
    const { saveProduct, products, isLoading: isLoadingProducts } = useProducts()
    const { uoms, isUoMsLoading: isLoadingUoMs } = useUoMs()
    const { warehouses, isLoading: isLoadingWarehouses } = useWarehouses()
    const { rules: pricingRules, isLoading: isLoadingPricingRules, refetch: refetchPricingRules } = useProductPricingRules(initialData?.id ?? null)

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [loading, setLoading] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [selectedPricingRule, setSelectedPricingRule] = useState<any | null>(null)
    const [pricingRuleDialogOpen, setPricingRuleDialogOpen] = useState(false)
    const [variantsRefreshKey, setVariantsRefreshKey] = useState(0)
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

    // Compuesto desde los hooks de reads — el padre lo expone como prop para
    // que paneles internos (tabs) reaccionen al boot.
    const isFetchingInitialData = open && (isLoadingUoMs || isLoadingWarehouses || isLoadingProducts || (initialData?.id ? isLoadingPricingRules : false))

    const [activeTab, setActiveTab] = useState("general")

    const width = formDrawerWidth("master", !!initialData?.id)

    const productDefaultValues = useMemo(() => initialData ? {
        code: initialData.code || "",
        name: initialData.name || "————————————",
        product_type: initialData.product_type || "STORABLE",
        can_be_sold: initialData.can_be_sold ?? true,
        has_bom: initialData.has_bom ?? false,
        has_variants: initialData.has_variants ?? false,
    } : {
        code: "",
        internal_code: "",
        name: "",
        category: "",
        product_type: lockedType || "STORABLE",
        sale_price: 0,
        sale_price_gross: 0,
        is_dynamic_pricing: false,
        uom: "",
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
        mfg_auto_finalize: false,
        boms: [],
        has_variants: false,
        parent_template: null,
        attribute_values: [],
        variant_display_name: "",
    }, [initialData, lockedType])

    const form: UseFormReturn<ProductFormValues> = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: productDefaultValues,
    })

    // Helper function to map field errors to tabs
    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: number } = {}

        // General tab fields
        const generalFields = ['name', 'category', 'product_type', 'can_be_sold', 'can_be_purchased', 'code']
        generalFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['general'] = (tabErrors['general'] || 0) + 1
            }
        })

        // Pricing tab fields
        const pricingFields = ['sale_price', 'sale_price_gross', 'sale_uom']
        pricingFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['pricing'] = (tabErrors['pricing'] || 0) + 1
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
            'payment_interval_days', 'default_invoice_type'
        ]
        subFields.forEach(field => {
            if (errors[field as keyof typeof errors]) {
                tabErrors['subscription'] = (tabErrors['subscription'] || 0) + 1
            }
        })

        return tabErrors
    }

    // Memoize tab errors to prevent redundant re-renders of the entire form
    const tabErrors = useMemo(() => getTabsWithErrors(), [form.formState.errors])

    const productType = form.watch("product_type")
    const watchedAdvancedMfg = form.watch("requires_advanced_manufacturing")
    const hasBom = form.watch("has_bom")
    const canBeSold = form.watch("can_be_sold")
    const hasVariants = form.watch("has_variants")

    // Effect 1: Product-type-driven business rules.
    // Fires only when product_type changes. Each branch is idempotent — setValue
    // is guarded by getValues comparison to avoid spurious notifications.
    // Production-mode rules (advanced/express/simple) live in ProductManufacturingTab's
    // Tabs onValueChange handler — not here — to avoid cross-component cascade.
    useEffect(() => {
        const opts = { shouldDirty: false, shouldValidate: false, shouldTouch: false }

        if (productType === "STORABLE") {
            if (!form.getValues("track_inventory") && !form.getValues("requires_advanced_manufacturing") && !form.getValues("mfg_auto_finalize")) {
                form.setValue("track_inventory", true, opts)
            }
        } else if (productType === "CONSUMABLE") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false, opts)
        } else if (productType === "SERVICE") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false, opts)
        } else if (productType === "SUBSCRIPTION") {
            if (form.getValues("track_inventory")) form.setValue("track_inventory", false, opts)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productType])

    // Effect 2: Tab redirect when active tab becomes invalid.
    // Pure read of derived state — never mutates form fields.
    useEffect(() => {
        const isTabValid = (tab: string): boolean => {
            switch (tab) {
                case "general": return true
                case "manufacturing": return productType === 'MANUFACTURABLE' || hasBom || watchedAdvancedMfg
                case "logistics": return ['STORABLE', 'MANUFACTURABLE'].includes(productType)
                case "commercial": return productType === 'SUBSCRIPTION'
                case "pricing": return canBeSold && productType !== 'SUBSCRIPTION'
                case "variants": return hasVariants && !variantMode
                default: return false
            }
        }

        if (!isTabValid(activeTab) && activeTab !== "general") {
            setActiveTab("general")
        }
    }, [productType, watchedAdvancedMfg, hasBom, canBeSold, hasVariants, activeTab, variantMode])

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stockUomId, uoms])

    // uoms / warehouses / products / pricingRules vienen de hooks reactivos
    // (useUoMs / useWarehouses / useProducts / useProductPricingRules) declarados
    // arriba. No hace falta fetch imperativo ni Promise.all — TanStack Query
    // re-fetchea automáticamente cuando productId / initialData.id cambia.

    useEffect(() => {
        if (open) {
            setActiveTab("general")

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
                    uom_prices: initialData.uom_prices?.map((p: any) => ({
                        id: p.id,
                        uom: typeof p.uom === 'object' ? p.uom.id : Number(p.uom),
                        price_net: Number(p.price_net) || 0,
                        price_gross: Number(p.price_gross) || 0,
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
                    mfg_auto_finalize: false,
                    boms: [],
                    has_variants: false,
                    is_dynamic_pricing: false,
                    parent_template: null,
                    attribute_values: [],
                    variant_display_name: "",
                    preferred_supplier: "",
                })
                setImagePreview(null)
                // pricingRules viene de useProductPricingRules — al crear un
                // producto nuevo (sin initialData.id) el hook ya devuelve [].
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
        if (onLoadingChange) onLoadingChange(true)
        try {
            const formData = new FormData()
            if (data.code && data.code.trim()) {
                formData.append('code', data.code.trim())
            }
            formData.append('name', data.name)
            formData.append('category', data.category)
            formData.append('product_type', data.product_type)
            formData.append('sale_price', data.sale_price.toString())
            formData.append('sale_price_gross', (data.sale_price_gross || 0).toString())
            formData.append('is_dynamic_pricing', data.is_dynamic_pricing ? 'true' : 'false')

            const appendValid = (key: string, val: any) => {
                if (val !== undefined && val !== null && val !== 'undefined' && val !== '') {
                    formData.append(key, val)
                }
            }

            // Related IDs - Sanitization (Avoid sending empty strings which can cause 400 errors)
            appendValid('category', data.category)
            appendValid('uom', data.uom)
            appendValid('sale_uom', data.sale_uom)
            appendValid('purchase_uom', data.purchase_uom)
            appendValid('receiving_warehouse', data.receiving_warehouse)

            if (data.preferred_supplier && data.preferred_supplier !== 'undefined') {
                formData.append('preferred_supplier', data.preferred_supplier)
            } else {
                formData.append('preferred_supplier', '') // Clear preferred supplier
            }

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
            formData.append('mfg_auto_finalize', data.mfg_auto_finalize ? 'true' : 'false')
            formData.append('has_variants', data.has_variants ? 'true' : 'false')
            if (data.parent_template) formData.append('parent_template', data.parent_template)
            if (data.variant_display_name) formData.append('variant_display_name', data.variant_display_name)
            if (data.attribute_values && data.attribute_values.length > 0) {
                data.attribute_values.forEach(v => formData.append('attribute_values', v))
            }

            // BOMs - Always send if present (fixes persistence bug on PUT)
            if (data.boms && data.boms.length > 0) {
                formData.append('boms', JSON.stringify(data.boms))
            }
            if (data.variant_updates && data.variant_updates.length > 0) {
                formData.append('variant_updates', JSON.stringify(data.variant_updates))
            }
            if (data.uom_prices && data.uom_prices.length > 0) {
                formData.append('uom_prices', JSON.stringify(data.uom_prices))
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

            // saveProduct invalida PRODUCTS_KEYS.all (cubre listado, detalle, etc.)
            // y lanza markLocalMutation() para que el entity bus descarte el eco propio.
            // El toast de éxito lo emite el hook.
            await saveProduct({ id: initialData?.id ?? null, payload: formData })
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Error saving product", error)
            showApiError(error, "No se pudo guardar el producto.")
        } finally {
            setLoading(false)
            if (onLoadingChange) onLoadingChange(false)
        }
    }

    const tabItems: TabItem[] = [
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
            label: "Precios",
            icon: DollarSign,
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

    const drawerTitle = isView
        ? `Ficha de Producto${initialData?.id ? ` #${initialData.id}` : ""}`
        : mode === 'create'
            ? "Nuevo Producto"
            : "Editar Producto"

    const tabHeader = (
        <div className="flex flex-col p-6 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <Package className="h-6 w-6 text-primary" />
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-0.5">
                        {drawerTitle}
                    </span>
                    <span className="truncate max-w-[300px]">
                        {initialData ? form.watch("name") : "Maestro de Producto"}
                    </span>
                </div>
            </h1>
        </div>
    )

    const footerSlot = isView ? undefined : (
        <FormFooter
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting} />
                    <ActionSlideButton type="submit" form="product-form" loading={form.formState.isSubmitting}>
                        {mode === 'create' ? "Crear Producto" : "Guardar Cambios"}
                    </ActionSlideButton>
                </>
            }
        />
    )

    const formContent = (
        <>
            <Form {...form}>
                <form id="product-form" onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="flex-1 w-full h-full flex flex-col min-h-0 overflow-visible">
                    <fieldset disabled={isView} className="contents h-full">
                    <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando ficha de producto" className="flex-1 flex flex-col h-full">
                        <FormSplitLayout
                            showSidebar={!!initialData?.id}
                            sidebar={
                                initialData?.id ? (
                                    <ActivitySidebar entityId={initialData.id.toString()} entityType="product" />
                                ) : undefined
                            }
                            className="min-w-0 h-full overflow-hidden p-0"
                        >
                            <UnderlineTabs
                                items={tabItems}
                                value={activeTab}
                                onValueChange={setActiveTab}
                                orientation="horizontal"
                                variant="underline"
                                header={inline ? tabHeader : undefined}
                                className="flex-1"
                                contentClassName="bg-transparent"
                            >
                                <fieldset disabled={loading} className="flex-1 min-w-0 flex flex-col h-full min-h-0">
                                    <UnderlineTabsContent value="general" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                        <div className="space-y-8 pr-2">
                                            <ProductBasicInfo
                                                form={form}
                                                isEditing={!!initialData}
                                                imagePreview={imagePreview}
                                                setImagePreview={setImagePreview}
                                                lockedType={lockedType}
                                            />
                                        </div>
                                    </UnderlineTabsContent>

                                    <UnderlineTabsContent value="manufacturing" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                        <ProductManufacturingTab
                                            form={form}
                                            initialData={initialData}
                                            products={products as unknown as Product[]}
                                            uoms={uoms as unknown as UoM[]}
                                            variantMode={variantMode}
                                        />
                                    </UnderlineTabsContent>

                                    <UnderlineTabsContent forceMount value="variants" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 data-[state=inactive]:hidden overflow-y-auto scrollbar-thin">
                                        <ProductVariantsTab
                                            key={variantsRefreshKey}
                                            form={form}
                                            initialData={initialData}
                                            onTabChange={(tab: string) => setActiveTab(tab)}
                                            onEditVariant={(v) => {
                                                window.open(`/inventory/products?selected=${v.id}`, '_blank');
                                            }}
                                        />
                                    </UnderlineTabsContent>

                                    <UnderlineTabsContent value="logistics" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                        <ProductInventoryTab
                                            form={form}
                                            initialData={initialData}
                                            warehouses={warehouses}
                                            uoms={uoms as unknown as UoM[]}
                                            isEditing={!!initialData}
                                        />
                                    </UnderlineTabsContent>

                                    <UnderlineTabsContent value="commercial" className="mt-0 animate-in fade-in duration-300 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                        <ProductSubscriptionTab form={form} isEditing={!!initialData} />
                                    </UnderlineTabsContent>

                                    <UnderlineTabsContent value="pricing" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                        <div className="space-y-8 pr-2">
                                            <ProductPricingSection
                                                form={form}
                                                initialData={initialData}
                                                canBeSold={canBeSold}
                                                uoms={uoms as unknown as UoM[]}
                                            />
                                            <ProductPricingTab
                                                initialData={initialData}
                                                pricingRules={pricingRules}
                                                fetchPricingRules={refetchPricingRules}
                                                onOpenRuleDialog={(rule) => {
                                                    setSelectedPricingRule(rule || null)
                                                    setPricingRuleDialogOpen(true)
                                                }}
                                                isDynamicPricing={form.watch('is_dynamic_pricing')}
                                                isVariant={!!initialData?.parent_template}
                                            />
                                        </div>
                                    </UnderlineTabsContent>
                                </fieldset>
                            </UnderlineTabs>
                        </FormSplitLayout>
                    </SkeletonShell>
                </fieldset>
                </form>
            </Form>

            {/* Nested Modals */}
            <PricingRuleDrawer
                open={pricingRuleDialogOpen}
                onOpenChange={(open) => {
                    setPricingRuleDialogOpen(open)
                    if (!open) setSelectedPricingRule(null)
                }}
                initialData={selectedPricingRule}
                onSuccess={refetchPricingRules}
                productId={initialData?.id}
                productName={initialData?.name}
            />
        </>
    )

    if (inline) {
        return (
            <>
                {formContent}
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
            </>
        )
    }

    return (
        <>
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="Product"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Código:</span>
                            <span>{initialData?.code ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={(newOpen) => {
                    if (!newOpen && Object.keys(form.formState.dirtyFields).length > 0) {
                        setConfirmCloseOpen(true)
                        return
                    }
                    onOpenChange(newOpen)
                }}
                defaultSize={width}
                className="h-[90vh]"
                icon={getEntityIcon('inventory.product')}
                title={<span>{drawerTitle}</span>}
                headerActions={(mode === 'view' || mode === 'edit') && initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={initialData ? form.watch("name") : "Maestro de Producto"}
                mode={mode}
                footer={footerSlot}
                side="left"
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
        </Drawer>
        </>
    )
}
