"use client"

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { ProductForm } from "./ProductForm"
import { useProduct } from "../hooks/useProducts"

interface ProductDetailClientProps {
    productId: string
}

// Placeholder tipado para el esqueleto - sigue el patrón del contrato
// Usamos los mismos valores que ProductForm usa como defaultValues cuando no hay datos
const PRODUCT_SKELETON = {
    id: 0,
    code: "————————————",
    internal_code: "————————————",
    name: "————————————",
    product_type: "STORABLE",
    category: { id: 0, name: "————————————" },
    sale_price: 0,
    sale_price_gross: 0,
    is_dynamic_pricing: false,
    current_stock: 0,
    qty_available: 0,
    has_bom: false,
    manufacturable_quantity: null,
    requires_advanced_manufacturing: false,
    mfg_auto_finalize: false,
    requires_bom_validation: false,
    has_variants: false,
    variants: [],
    uom: { id: 0, name: "————————————", category: 0 },
    sale_uom: { id: 0, name: "————————————" },
    purchase_uom: { id: 0, name: "————————————" },
    allowed_sale_uoms: [],
    image: null,
    can_be_sold: true,
    can_be_purchased: true,
    track_inventory: true,
    receiving_warehouse: { id: 0, name: "————————————" },
    income_account: { id: 0, name: "————————————" },
    expense_account: { id: 0, name: "————————————" },
    preferred_supplier: { id: 0, name: "————————————" },

    // Manufacturing fields
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
    parent_template: null,
    attribute_values: [],
    attribute_values_data: [],
    variant_display_name: "",
    has_active_bom: false,

    // Subscription fields
    recurrence_period: "MONTHLY",
    renewal_notice_days: 30,
    is_variable_amount: false,
    payment_day_type: null,
    payment_day: null,
    payment_interval_days: null,
    default_invoice_type: null,
    subscription_supplier: { id: 0, name: "————————————" },
    subscription_amount: null,
    subscription_start_date: "",
    auto_activate_subscription: true,
    is_indefinite: true,
    contract_end_date: "",

    // BOM
    boms: [],
    product_custom_fields: [],

    // Variant price inheritance
    price_inheritance_mode: 'INHERIT',
    price_surcharge: null,
    effective_price_net: 0,

    // Per-UoM prices
    uom_prices: []
};

export function ProductDetailClient({ productId }: ProductDetailClientProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const numericId = Number(productId)
    const idIsValid = Number.isFinite(numericId) && numericId > 0

    const { data: product, isLoading: loading, error: queryError } = useProduct(idIsValid ? numericId : null)

    const error = queryError ? (queryError as { response?: { status?: number } })?.response?.status ?? 500 : null

    if (!idIsValid || error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar el producto</div>

    return (
        <SkeletonShell isLoading={loading || !product} ariaLabel="Cargando detalle de producto">
            <EntityDetailPage
                entityLabel="inventory.product"
                displayId={(product ?? PRODUCT_SKELETON).code || (product ?? PRODUCT_SKELETON).name}
                breadcrumb={[
                    { label: "Productos", href: "/inventory/products" },
                    { label: (product ?? PRODUCT_SKELETON).code || (product ?? PRODUCT_SKELETON).name, href: `/inventory/products/${productId}` }
                ]}
                instanceId={(product ?? PRODUCT_SKELETON).id ?? 0}
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => router.push('/inventory/products')} disabled={isSaving} />
                                <SubmitButton form="product-form" loading={isSaving}>
                                    Guardar Cambios
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >
                <div className="h-full">
                    <ProductForm
                        open={true}
                        inline={true}
                        onOpenChange={(open) => {
                            if (!open) router.push('/inventory/products')
                        }}
                        initialData={product}
                        onLoadingChange={setIsSaving}
                        onSuccess={() => {
                            router.push('/inventory/products')
                        }}
                    />
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )
}
