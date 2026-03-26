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
    track_inventory: boolean
    can_be_sold: boolean
    can_be_purchased: boolean
    active: boolean
    is_dynamic_pricing?: boolean
    has_variants?: boolean
    variants?: Product[]
    is_child_variant?: boolean
    variant_display_name?: string
}

export interface ProductFilters {
    active?: string | boolean
    can_be_sold?: boolean
    can_be_purchased?: boolean
    parent_template__isnull?: boolean
    search?: string
    category?: number
}

export interface ProductUpdatePayload {
    active?: boolean;
    // other fields as necessary
}
