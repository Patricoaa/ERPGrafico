// ProductGridPicker/product-card-model
// Pure view-model for ProductCard: what the card says about a product, with no JSX.
// One place for the availability / action / price rules that used to be five copy-pasted badge blocks.

import type { BaseProduct } from '@/features/inventory'
import { PricingUtils } from '@/lib/pricing-utils'
import { formatQuantity } from '@/lib/money'

export type AvailabilityTone = 'ok' | 'warning' | 'none' | 'neutral'
export type AvailabilityIcon = 'stock' | 'service' | 'manufacture' | 'blocked'
/** add = `+`, configure = `›` (opens variants / options), unavailable = `–` */
export type CardAction = 'add' | 'configure' | 'unavailable'
export type CardPriceKind = 'fixed' | 'from' | 'pending'

export interface CardAvailability {
    text: string
    tone: AvailabilityTone
    icon: AvailabilityIcon
}

export interface CardPrice {
    kind: CardPriceKind
    /** Gross (c/IVA) amount; null while the price is only known once the product is added. */
    gross: number | null
    /** Lowercase unit shown after the amount ("pliego"). */
    unit: string | null
}

export interface ProductCardModel {
    code: string | null
    availability: CardAvailability | null
    action: CardAction
    price: CardPrice
    isDynamicPricing: boolean
    /** Bottom-left image chip for templates: "4 gramajes" */
    variantChip: string | null
}

export interface ProductCardContext {
    /** Stock override from the POS branch (`limits["prod_<id>"]`). */
    limit?: number
    isDisabled: boolean
}

const VOWEL_END = /[aeiouáéíóú]$/i

/** Spanish plural for an attribute name: Gramaje → gramajes, Color → colores, Luz → luces. */
export function pluralizeEs(word: string): string {
    const w = word.trim().toLowerCase()
    if (!w) return w
    if (VOWEL_END.test(w)) return `${w}s`
    if (w.endsWith('z')) return `${w.slice(0, -1)}ces`
    return `${w}es`
}

export function variantChipLabel(count: number, axisLabel?: string | null): string {
    const axis = axisLabel?.trim().toLowerCase()
    if (count === 1) return `1 ${axis ?? 'variante'}`
    return `${count} ${axis ? pluralizeEs(axis) : 'variantes'}`
}

function unitOf(product: BaseProduct): string | null {
    return product.uom_name ? product.uom_name.toLowerCase() : null
}

function stockAvailability(product: BaseProduct, ctx: ProductCardContext): CardAvailability {
    const qty = ctx.limit ?? product.qty_available ?? 0
    if (qty <= 0) return { text: 'Sin existencias', tone: 'none', icon: 'blocked' }
    const unit = unitOf(product)
    return { text: `${formatQuantity(qty, 2).replace(/,00$/, '')}${unit ? ` ${unit}` : ''} disponibles`, tone: 'ok', icon: 'stock' }
}

function manufacturableAvailability(product: BaseProduct, ctx: ProductCardContext): CardAvailability {
    const isExpress = !product.requires_advanced_manufacturing && product.mfg_auto_finalize
    const isAdvanced = Boolean(product.requires_advanced_manufacturing)
    if (!isExpress && !isAdvanced) return stockAvailability(product, ctx)

    const makeable = product.manufacturable_quantity ?? 0
    const makeableText = `${formatQuantity(makeable, 0)} fabricables`
    if (isExpress) {
        if (!product.has_bom) return { text: 'Sin lista de materiales', tone: 'neutral', icon: 'manufacture' }
        return { text: makeableText, tone: makeable > 0 ? 'ok' : 'none', icon: 'manufacture' }
    }
    if (!product.has_bom) return { text: 'Disponible', tone: 'ok', icon: 'manufacture' }
    return { text: makeableText, tone: makeable > 0 ? 'ok' : 'warning', icon: 'manufacture' }
}

export function getAvailability(product: BaseProduct, ctx: ProductCardContext): CardAvailability | null {
    // Templates: availability lives in the variants, not in the template itself.
    if (product.has_variants) {
        if (product.product_type === 'SERVICE') return { text: 'Servicio · bajo demanda', tone: 'neutral', icon: 'service' }
        return { text: 'Disponibilidad por variante', tone: 'neutral', icon: 'stock' }
    }
    switch (product.product_type) {
        case 'STORABLE':
            return stockAvailability(product, ctx)
        case 'MANUFACTURABLE':
            return manufacturableAvailability(product, ctx)
        case 'SERVICE':
            return { text: 'Servicio · bajo demanda', tone: 'neutral', icon: 'service' }
        case 'SUBSCRIPTION':
            return { text: 'Suscripción', tone: 'neutral', icon: 'service' }
        case 'CONSUMABLE':
            return { text: 'Disponible', tone: 'ok', icon: 'stock' }
        default:
            return null
    }
}

function positiveNumber(value: string | number | null | undefined): number | null {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : null
}

export function getPrice(product: BaseProduct): CardPrice {
    const unit = unitOf(product)
    const fromNet = product.has_variants ? positiveNumber(product.min_variant_price) : null
    if (fromNet !== null) return { kind: 'from', gross: PricingUtils.netToGross(fromNet), unit }

    const net = positiveNumber(product.sale_price)
    if (product.is_dynamic_pricing) {
        return net === null
            ? { kind: 'pending', gross: null, unit }
            : { kind: 'from', gross: PricingUtils.netToGross(net), unit }
    }
    return { kind: 'fixed', gross: PricingUtils.netToGross(Number(product.sale_price || 0)), unit }
}

export function getAction(product: BaseProduct, ctx: ProductCardContext): CardAction {
    if (ctx.isDisabled) return 'unavailable'
    return product.has_variants || product.is_dynamic_pricing ? 'configure' : 'add'
}

export function getProductCardModel(product: BaseProduct, ctx: ProductCardContext): ProductCardModel {
    return {
        code: product.internal_code || product.code || null,
        availability: getAvailability(product, ctx),
        action: getAction(product, ctx),
        price: getPrice(product),
        isDynamicPricing: Boolean(product.is_dynamic_pricing),
        variantChip: product.has_variants ? variantChipLabel(product.variants_count ?? 0, product.variant_axis_label) : null,
    }
}
