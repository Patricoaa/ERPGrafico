// ADR-0151: los formularios envían solo el bruto; el backend deriva el neto.

import type { Product } from "@/types/entities"
import { grossFromNet, netFromGross } from "@/lib/vat"

/** Bruto autoritativo de un producto; si la API no lo trae, se deriva del neto. */
export function grossOf(p: Pick<Product, "sale_price" | "sale_price_gross"> | undefined, multiplier: number): number {
    return p?.sale_price_gross != null && p.sale_price_gross !== ""
        ? Number(p.sale_price_gross) || 0
        : grossFromNet(Number(p?.sale_price) || 0, multiplier)
}

export interface GrossPriceFields {
    net: number
    gross: number
}

/** Neto tipeado -> bruto autoritativo; el neto mostrado siempre sale del bruto. */
export function fromTypedNet(net: number, multiplier: number): GrossPriceFields {
    const gross = grossFromNet(net, multiplier)
    return { gross, net: netFromGross(gross, multiplier) }
}

/** Bruto tipeado -> neto derivado del bruto. */
export function fromTypedGross(gross: number, multiplier: number): GrossPriceFields {
    const g = Math.round(gross)
    return { gross: g, net: netFromGross(g, multiplier) }
}

interface UomPriceRow {
    id?: number
    uom: number
    price_gross: number
}

/** Filas de precio por UoM: solo `price_gross` (sin `price_net`). */
export function uomPricesGrossPayload(rows: readonly UomPriceRow[]): UomPriceRow[] {
    return rows.map(({ id, uom, price_gross }) => ({
        ...(id !== undefined ? { id } : {}),
        uom,
        price_gross: Math.round(Number(price_gross) || 0),
    }))
}

export interface VariantQuickEditInput {
    price_inheritance_mode: "INHERIT" | "OVERRIDE" | "SURCHARGE"
    /** Bruto del override (con IVA). */
    sale_price_gross: number
    /** Bruto del recargo (con IVA). */
    price_surcharge_gross?: number
    code: string
    sale_uom: number | undefined
}

export function variantQuickEditPayload(input: VariantQuickEditInput) {
    const { price_inheritance_mode: mode } = input
    return {
        code: input.code,
        sale_uom: input.sale_uom,
        price_inheritance_mode: mode,
        ...(mode === "OVERRIDE" ? { sale_price_gross: Math.round(input.sale_price_gross) } : {}),
        price_surcharge_gross: mode === "SURCHARGE" ? (input.price_surcharge_gross ?? null) : null,
    }
}
