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
/** dynamic = the amount is resolved when the product is added, so the card shows "Precio dinámico" instead of a number */
export type CardPriceKind = 'fixed' | 'from' | 'dynamic'

export interface CardAvailability {
    text: string
    tone: AvailabilityTone
    icon: AvailabilityIcon
}

export interface CardPrice {
    kind: CardPriceKind
    /** Gross (c/IVA) amount; null for dynamic pricing. */
    gross: number | null
    /** Lowercase unit shown after the amount ("pliego"). */
    unit: string | null
}

export interface ProductCardModel {
    code: string | null
    availability: CardAvailability | null
    action: CardAction
    price: CardPrice
    /** The card cannot be picked: disabled by the caller, or a template with no active variants. */
    isUnavailable: boolean
    /** Bottom-left image chip for templates: "4 gramajes" */
    variantChip: string | null
}

export interface ProductCardContext {
    /** Stock override from the POS branch (`limits["prod_<id>"]`). */
    limit?: number
    isDisabled: boolean
}

/** Up to two decimals, no trailing zeros: 12,5 · 3.600. */
const QUANTITY_FORMAT = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

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

/**
 * "pliego" → "pliegos" for quantities ≠ 1. Only the leading word of a UoM name is pluralised and a
 * parenthetical suffix is kept as is ("resma (500 pl)" → "resmas (500 pl)"); abbreviations ("kg", "m2") stay.
 */
function unitForQuantity(unit: string, qty: number): string {
    if (qty === 1) return unit
    const [head, ...rest] = unit.split(' (')
    if (head.length <= 3 || /\d/.test(head)) return unit
    return [pluralizeEs(head), ...rest].join(' (')
}

function stockAvailability(product: BaseProduct, ctx: ProductCardContext): CardAvailability {
    const qty = ctx.limit ?? product.qty_available ?? 0
    if (qty <= 0) return { text: 'Sin existencias', tone: 'none', icon: 'blocked' }
    const unit = unitOf(product)
    const amount = QUANTITY_FORMAT.format(qty)
    return { text: `${amount}${unit ? ` ${unitForQuantity(unit, qty)}` : ''} disponibles`, tone: 'ok', icon: 'stock' }
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
        if (product.variants_count === 0) return { text: 'Sin variantes', tone: 'none', icon: 'blocked' }
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
    if (product.is_dynamic_pricing) return { kind: 'dynamic', gross: null, unit }

    const fromNet = product.has_variants ? positiveNumber(product.min_variant_price) : null
    if (fromNet !== null) return { kind: 'from', gross: PricingUtils.netToGross(fromNet), unit }

    return { kind: 'fixed', gross: PricingUtils.netToGross(Number(product.sale_price || 0)), unit }
}

/** Templates without active variants have nothing to configure, so they behave as disabled. */
function hasNoVariants(product: BaseProduct): boolean {
    return Boolean(product.has_variants) && product.variants_count === 0
}

export function getAction(product: BaseProduct, ctx: ProductCardContext): CardAction {
    if (ctx.isDisabled || hasNoVariants(product)) return 'unavailable'
    return product.has_variants || product.is_dynamic_pricing ? 'configure' : 'add'
}

export function getProductCardModel(product: BaseProduct, ctx: ProductCardContext): ProductCardModel {
    return {
        code: product.internal_code || product.code || null,
        availability: getAvailability(product, ctx),
        action: getAction(product, ctx),
        price: getPrice(product),
        isUnavailable: ctx.isDisabled || hasNoVariants(product),
        variantChip: product.has_variants && (product.variants_count ?? 0) > 0
            ? variantChipLabel(product.variants_count ?? 0, product.variant_axis_label)
            : null,
    }
}
