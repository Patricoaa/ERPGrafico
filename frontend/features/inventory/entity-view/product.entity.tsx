"use client"

import { Boxes, Package, Repeat, Wrench, type LucideIcon } from "lucide-react"
import { Chip, DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, toNumber, formatMoneyValue, type ValueRenderProps } from "@/components/entity-view"
import { cn } from "@/lib/utils"
import { resolveMediaUrl } from "../api/inventoryApi"
import type { Product } from "../types"

/**
 * Feature extension: product sale price. Dynamic pricing replaces the amount with a chip
 * (category C of the computed audit). Used by one entity → extension, not core (Gate B rule).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        productPrice: { value: { gross: number | string | null; dynamic: boolean }; options: Record<never, never> }
    }
}

function ProductPriceCell({ value, align }: ValueRenderProps<"productPrice">) {
    const end = align === "end"
    if (value.dynamic) {
        return (
            <div className={cn("flex w-full", end ? "justify-end" : "justify-start")}>
                <Chip size="xs" intent="warning">Dinámico</Chip>
            </div>
        )
    }
    return <DataCell.Currency value={value.gross} align={align} className={end ? "justify-end text-right" : "justify-start text-left"} />
}

let registered = false
export function registerInventoryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("productPrice", {
        format: (v) => (v.dynamic ? "Dinámico" : formatMoneyValue(v.gross)),
        sortValue: (v) => (v.dynamic ? null : toNumber(v.gross)),
        align: "end",
        render: ProductPriceCell,
    })
}

const TYPE_ICON: Record<string, LucideIcon> = {
    STORABLE: Boxes,
    CONSUMABLE: Package,
    SERVICE: Wrench,
    SUBSCRIPTION: Repeat,
}

const availability = (p: Product): string[] => [
    ...(p.can_be_sold ? ["Venta"] : []),
    ...(p.can_be_purchased ? ["Compra"] : []),
]

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerInventoryValueKinds()

/** Product — one of the two most rigid screens (22 inline columns, 2 computed, renderCard with image). */
export const productEntity = defineEntity<Product>()((f) => ({
    label: "inventory.product",
    fields: {
        internalCode: f.code("internal_code", { label: "Código interno", orderBy: "internal_code" }),
        sku: f.text("code", { label: "SKU", tone: "secondary", orderBy: "code" }),
        name: f.text("name", { label: "Nombre", orderBy: "name" }),
        category: f.text("category_name", { label: "Categoría", tone: "secondary", orderBy: "category__name" }),
        type: f.tags((p) => [p.product_type], { label: "Tipo", domain: "product_type", orderBy: "product_type" }),
        // Services carry no stock: "—" instead of "0 Unidad".
        stock: f.quantity((p) => (p.product_type === "SERVICE" ? null : p.current_stock), { label: "Stock", uom: (p) => p.uom_name, orderBy: "annotated_current_stock" }),
        price: f.value("productPrice", (p) => ({ gross: p.sale_price_gross || p.sale_price, dynamic: !!p.is_dynamic_pricing }), { label: "Total (c/IVA)", sortable: false }), // shown gross or dynamic; the server can only sort by the net sale_price
        availability: f.tags(availability, { label: "Disponible para" }),
    },
}))

export const productViews = productEntity.views({
    table: { columns: ["internalCode", "name", "sku", "category", "type", "stock", "price"], primary: "name", defaultSort: "name" },
    card: {
        code: "internalCode",
        title: "name",
        subtitle: ["category"],
        meta: ["availability", "stock"],
        footer: { value: "price" },
        media: { placement: "top", iconFor: (p) => TYPE_ICON[p.product_type] ?? Package, image: (p) => resolveMediaUrl(p.image_thumbnail ?? p.image ?? null) },
    },
})
