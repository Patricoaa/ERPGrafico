// ADR-0151: la regla de precio envía solo el bruto (`fixed_price_gross`).

import { grossFromNet, netFromGross } from "@/lib/vat"

export interface RulePriceFields {
    net: string
    gross: string
}

const EMPTY: RulePriceFields = { net: "", gross: "" }

/** Neto tipeado -> bruto autoritativo; el neto mostrado sale del bruto. */
export function rulePriceFromNet(value: string, multiplier: number): RulePriceFields {
    const net = parseFloat(value)
    if (!value || Number.isNaN(net)) return EMPTY
    const gross = grossFromNet(net, multiplier)
    return { gross: String(gross), net: String(netFromGross(gross, multiplier)) }
}

export function rulePriceFromGross(value: string, multiplier: number): RulePriceFields {
    const parsed = parseFloat(value)
    if (!value || Number.isNaN(parsed)) return EMPTY
    const gross = Math.round(parsed)
    return { gross: String(gross), net: String(netFromGross(gross, multiplier)) }
}

interface RuleValues {
    rule_type: "FIXED" | "DISCOUNT_PERCENTAGE" | "PACKAGE_FIXED"
    product?: number | null
    operator: string
    max_quantity?: string | number | null
    fixed_price?: string | number | null
    fixed_price_gross?: string | number | null
    [key: string]: unknown
}

/** Quita el neto siempre; los descuentos porcentuales no envían campos de precio. */
export function buildPricingRulePayload<T extends RuleValues>(values: T): Omit<T, "fixed_price"> {
    const { fixed_price: _net, ...rest } = values
    void _net
    const payload: Record<string, unknown> = { ...rest }
    if (payload.product === null) delete payload.product
    if (payload.operator !== "BT") delete payload.max_quantity
    if (values.rule_type === "DISCOUNT_PERCENTAGE") {
        delete payload.fixed_price_gross
    } else if (payload.fixed_price_gross === "" || payload.fixed_price_gross === null) {
        delete payload.fixed_price_gross
    } else {
        payload.fixed_price_gross = Number(payload.fixed_price_gross)
    }
    return payload as Omit<T, "fixed_price">
}
