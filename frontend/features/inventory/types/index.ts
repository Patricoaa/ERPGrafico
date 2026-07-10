// ─── Shared product selector foundation types ────────────────────────────────
// These types are used by @/components/shared/ProductSelector and can be safely
// imported by any feature without pulling in POS-specific context.

/**
 * Minimal category shape used by ProductSelector.
 * Features that need richer category data should extend this.
 */
export interface ProductCategory {
    id: number
    name: string
    icon?: string | null
}

/**
 * Minimal product shape required by ProductSelector components
 * (SearchBar, CategoryFilter, ProductGrid, VariantSelectorModal).
 *
 * - POS: uses the full Product from @/types/pos (which has POS-specific fields).
 * - Other consumers (cost calculator, purchasing…): can pass BaseProduct directly.
 */
export interface ProductAttributeValueDisplay {
    id: number
    attribute_name: string
    value: string
}

export interface BaseProduct {
    id: number
    code: string
    internal_code?: string
    name: string
    sale_price: string | number
    sale_price_gross?: string | number
    product_type?: 'STORABLE' | 'CONSUMABLE' | 'SERVICE' | 'MANUFACTURABLE' | 'SUBSCRIPTION' | string
    image?: string | null
    /** Category as object OR as numeric FK */
    category?: { id: number; name: string; icon?: string | null } | number
    uom?: number
    uom_name?: string
    is_favorite?: boolean
    has_variants?: boolean
    variants_count?: number
    // Display fields used by ProductGrid and VariantSelectorModal visual badges
    qty_available?: number
    manufacturable_quantity?: number | null
    has_bom?: boolean
    has_active_bom?: boolean
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    is_dynamic_pricing?: boolean
    variant_display_name?: string
    attribute_values_data?: ProductAttributeValueDisplay[]
}

// ─── Existing inventory types ─────────────────────────────────────────────────

export interface Restriction {
    type: string
    label: string
    description: string
    action_hint?: string
    count: number
    link: string
}

export interface Product {
    id: number
    code: string
    internal_code: string
    name: string
    product_type: string
    category_id: number
    category_name: string
    sale_price: string
    sale_price_gross: string
    current_stock: number
    qty_reserved?: number
    qty_available?: number
    total_stock: number
    manufacturable_quantity?: number | null
    uom_name: string
    purchase_uom_name: string
    uom?: number
    track_inventory: boolean
    can_be_sold: boolean
    can_be_purchased: boolean
    image?: string | null
    image_thumbnail?: string
    image_catalog?: string
    is_active: boolean
    is_dynamic_pricing?: boolean
    cost_price?: string
    uom_category?: number
    price_inheritance_mode?: 'INHERIT' | 'OVERRIDE' | 'SURCHARGE'
    price_surcharge?: string | number | null
    effective_price_net?: string | number
    qty_on_hand?: number
    has_variants?: boolean
    variants?: Product[]
    is_child_variant?: boolean
    variant_display_name?: string
    requires_advanced_manufacturing?: boolean
    has_bom?: boolean
    mfg_enable_prepress?: boolean
    mfg_enable_press?: boolean
    mfg_enable_postpress?: boolean
    mfg_prepress_design?: boolean
    mfg_prepress_folio?: boolean
    mfg_press_offset?: boolean
    mfg_press_digital?: boolean
    mfg_press_special?: boolean
    mfg_auto_finalize?: boolean
    allowed_sale_uoms?: number[]
    uom_prices?: ProductUoMPrice[]
}

export interface ProductUoMPrice {
    id?: number
    uom: number
    price_net: number | string
    price_gross: number | string
}

export interface ProductFilters {
    is_active?: string | boolean
    can_be_sold?: boolean
    can_be_purchased?: boolean
    has_variants?: boolean
    parent_template__isnull?: boolean
    search?: string
    product_type?: string
    category?: number
    page?: number
    page_size?: number
    fields?: string
    track_inventory?: boolean
}

export interface ProductUpdatePayload {
    is_active?: boolean;
    sale_price?: string | number;
    code?: string;
    sale_uom?: number;
    price_inheritance_mode?: string;
    price_surcharge?: string | number | null;
}

// ─── Inventory Document types ──────────────────────────────────────────────────

export interface InventoryDocumentDetail {
    id: number
    product: number
    product_name: string
    product_code: string
    product_internal_code?: string
    uom_name: string
    warehouse: number
    warehouse_name: string
    source_warehouse?: number | null
    source_warehouse_name?: string | null
    quantity: string
    unit_cost: string
}

export interface InventoryDocument {
    id: number
    document_type: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION'
    document_type_display: string
    status: 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELLED'
    status_display: string
    date: string
    partner?: number | null
    partner_name?: string | null
    reference: string
    notes: string
    created_by?: number | null
    created_by_name?: string | null
    confirmed_by?: number | null
    confirmed_by_name?: string | null
    created_at: string
    updated_at: string
    details: InventoryDocumentDetail[]
}

export interface InventoryDocumentFilters {
    page?: number
    page_size?: number
    document_type?: string
    status?: string
    search?: string
    date_from?: string
    date_to?: string
}

