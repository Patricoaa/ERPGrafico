"use client"

import { Chip, DataCell } from "@/components/shared"
import { defineEntity, formatDate, formatMoneyValue, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { PricingRule } from "../hooks/usePricingRules"

/**
 * Feature extension: what a pricing rule applies to — a product (name + codes), a category or
 * everything. Replaces the inline "Aplica a" column. Used by one entity → lives with it.
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        pricingRuleTarget: { value: PricingRule; options: Record<never, never> }
    }
}

const targetText = (r: PricingRule): string =>
    r.product_name ?? (r.category_name ? `Categoría: ${r.category_name}` : "Todos")

function PricingRuleTargetCell({ value: rule }: ValueRenderProps<"pricingRuleTarget">) {
    if (!rule.product_name) {
        return (
            <div className="flex w-full justify-center">
                <Chip size="xs" className="w-fit">{targetText(rule)}</Chip>
            </div>
        )
    }
    return (
        <div className="flex w-full flex-col items-center gap-1 py-1">
            <DataCell.Text>{rule.product_name}</DataCell.Text>
            <div className="flex flex-wrap justify-center gap-1">
                {rule.product_internal_code && <DataCell.Code>{rule.product_internal_code}</DataCell.Code>}
                {rule.product_code && rule.product_code !== rule.product_internal_code && <DataCell.Code>{rule.product_code}</DataCell.Code>}
            </div>
        </div>
    )
}

let registered = false
function registerPricingRuleValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("pricingRuleTarget", {
        format: targetText,
        align: "center",
        render: PricingRuleTargetCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerPricingRuleValueKinds()

const condition = (r: PricingRule): string => {
    const min = Number(r.min_quantity)
    return r.operator === "BT" && r.max_quantity ? `${r.operator_display} ${min} y ${Number(r.max_quantity)}` : `${r.operator_display} ${min}`
}

const ruleValue = (r: PricingRule): string | null => {
    if (r.rule_type === "FIXED") return formatMoneyValue(r.fixed_price)
    return r.discount_percentage == null || r.discount_percentage === "" ? null : `${Number(r.discount_percentage)}%`
}

const validity = (r: PricingRule): string | null =>
    r.start_date || r.end_date ? `${r.start_date ? formatDate(r.start_date) : "..."} a ${r.end_date ? formatDate(r.end_date) : "..."}` : null

/** Pricing rule (ADR-0087 oleada A1). Replaces pricingRuleFields.ts + 6 inline columns + renderCard. */
export const pricingRuleEntity = defineEntity<PricingRule>()((f) => ({
    label: "inventory.pricingrule",
    fields: {
        code: f.code("id", { label: "Código Interno" }),
        name: f.text("name", { label: "Nombre" }),
        type: f.text("rule_type_display", { label: "Tipo" }),
        active: f.status((r) => (r.active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Inactivo" }), { label: "Estado" }),
        appliesTo: f.value("pricingRuleTarget", (r) => r, { label: "Aplica a", sortable: false }),
        condition: f.text(condition, { label: "Condición (Cantidad)", align: "center" }),
        uom: f.tags((r) => [r.uom_name || "Base"], { label: "UdM" }),
        value: f.text(ruleValue, { label: "Valor", align: "center", sortable: false }),
        validity: f.text(validity, { label: "Vigencia", align: "center", sortable: false }),
        priority: f.number("priority", { label: "Prioridad", align: "center" }),
    },
}))

export const pricingRuleViews = pricingRuleEntity.views({
    table: {
        columns: ["code", "name", "type", "active", "appliesTo", "condition", "uom", "value", "validity", "priority"],
        // No default sort: the server order (newest first) is kept.
        primary: "name",
    },
    card: { title: "name", subtitle: ["appliesTo", "type"], meta: ["condition", "value", "validity"], trailing: ["active"] },
})
