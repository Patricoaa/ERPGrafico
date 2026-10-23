"use client"

import { Layers } from "lucide-react"
import { Chip, DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { formatQuantity } from "@/lib/money"
import type { BOM } from "../types"

/**
 * Feature extension: the BOM's product with its internal and SKU codes (replaces the `computed`
 * column). Same shape as `pricingRuleTarget` in inventory: second consumer; it becomes a shared
 * extension when a third appears (Gate B rule).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        bomProduct: { value: BOM; options: Record<never, never> }
    }
}

function BomProductCell({ value: bom }: ValueRenderProps<"bomProduct">) {
    return (
        <div className="flex w-full flex-col items-center gap-1 py-1">
            <DataCell.Text>{bom.product_name}</DataCell.Text>
            <div className="flex flex-wrap justify-center gap-1">
                {bom.product_internal_code && <Chip size="xs" intent="neutral">{bom.product_internal_code}</Chip>}
                {bom.product_code && bom.product_code !== bom.product_internal_code && <Chip size="xs" intent="neutral">{bom.product_code}</Chip>}
            </div>
        </div>
    )
}

let registered = false
function registerBomValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("bomProduct", {
        format: (b) => b.product_name ?? "",
        align: "center",
        render: BomProductCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerBomValueKinds()

function componentsLabel(bom: BOM): string | undefined {
    if (bom.lines_count == null) return undefined
    return bom.lines_count === 1 ? "1 componente" : `${formatQuantity(bom.lines_count)} componentes`
}

/** Bill of materials (ADR-0087 oleada A4). Replaces bomFields.tsx (1 computed) + renderCard. */
export const bomEntity = defineEntity<BOM>()((f) => ({
    label: "production.bom",
    rowId: (b) => b.id ?? `${b.product}-${b.name}`,
    fields: {
        product: f.value("bomProduct", (b) => b, { label: "Producto" }),
        name: f.text("name", { label: "Nombre / Versión", align: "center" }),
        linesCount: f.number((b) => b.lines_count ?? 0, { label: "Componentes", suffix: "comp." }),
        totalCost: f.money("total_cost", { label: "Costo Total" }),
        active: f.status((b) => (b.active ? { status: "active", label: "Activa" } : { status: "inactive", label: "Inactiva" }), { label: "Estado" }),
    },
}))

export const bomViews = bomEntity.views({
    table: { columns: ["product", "name", "linesCount", "totalCost", "active"] },
    card: {
        title: "name",
        footer: { value: "totalCost" },
        muted: (b) => !b.active,
        media: {
            placement: "top",
            icon: Layers,
            badge: (b) => (b.active ? undefined : "Inactiva"),
            footnote: componentsLabel,
        },
    },
})
