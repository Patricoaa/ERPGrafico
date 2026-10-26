"use client"

import { Ban, Boxes, Factory, Layers, Package, Repeat, Wrench, type LucideIcon } from "lucide-react"
import { Chip, DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, toNumber, formatMoneyValue, type ValueRenderProps } from "@/components/entity-view"
import { cn } from "@/lib/utils"
import { resolveMediaUrl } from "../api/inventoryApi"
import { getAvailability, getPrice, variantChipLabel, type AvailabilityIcon, type AvailabilityTone, type CardAvailability, type CardPriceKind } from "../utils/productCardModel"
import type { Product } from "../types"

/**
 * Feature extension: product sale price. Dynamic pricing replaces the amount with a chip
 * (category C of the computed audit). Used by one entity → extension, not core (Gate B rule).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        productPrice: { value: { kind: CardPriceKind; gross: number | string | null; unit?: string | null }; options: Record<never, never> }
        /** Stock health / availability line (icon + text, toned): "5.420 un disponibles", "Sin existencias". */
        productAvailability: { value: CardAvailability | null; options: Record<never, never> }
    }
}

const AVAILABILITY_ICON: Record<AvailabilityIcon, LucideIcon> = { stock: Package, service: Wrench, manufacture: Factory, blocked: Ban }
const AVAILABILITY_TONE: Record<AvailabilityTone, string> = {
    ok: "text-success",
    warning: "text-warning",
    none: "text-destructive",
    neutral: "text-muted-foreground",
}

function ProductAvailabilityCell({ value }: ValueRenderProps<"productAvailability">) {
    if (!value) return <DataCell.Empty />
    const Icon = AVAILABILITY_ICON[value.icon]
    return (
        <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium", AVAILABILITY_TONE[value.tone])}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{value.text}</span>
        </span>
    )
}

function ProductPriceCell({ value, align, surface }: ValueRenderProps<"productPrice">) {
    const end = align === "end"
    const footer = surface === "cardFooter"
    if (value.kind === "dynamic") {
        if (footer) return <p className="text-sm font-semibold text-info">Precio dinámico</p>
        return (
            <div className={cn("flex w-full", end ? "justify-end" : "justify-start")}>
                <Chip size="xs" intent="warning">Dinámico</Chip>
            </div>
        )
    }
    const amount = (
        <DataCell.Currency
            value={value.gross}
            align={align}
            className={cn(end ? "justify-end text-right" : "justify-start text-left", footer && "w-auto text-lg font-semibold")}
        />
    )
    // Pinned card amount: "desde $8.500 / pliego". Templates price from their cheapest variant,
    // and the unit stays small and muted like the POS ProductCard.
    if (footer) {
        return (
            <div className="flex items-baseline gap-1">
                {value.kind === "from" && <span className="shrink-0 whitespace-nowrap text-2xs font-normal text-muted-foreground">desde</span>}
                {amount}
                {value.unit && (
                    <span className="max-w-[60%] shrink-0 truncate text-2xs text-muted-foreground">
                        / {value.unit.toLowerCase()}
                    </span>
                )}
            </div>
        )
    }
    if (value.kind === "from") {
        return (
            <div className={cn("flex w-full items-baseline gap-1", end ? "justify-end" : "justify-start")}>
                <span className="shrink-0 text-2xs font-normal text-muted-foreground">desde</span>
                {amount}
            </div>
        )
    }
    return amount
}

let registered = false
export function registerInventoryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("productPrice", {
        format: (v) => (v.kind === "dynamic" ? "Dinámico" : v.kind === "from" ? `Desde ${formatMoneyValue(v.gross)}` : formatMoneyValue(v.gross)),
        sortValue: (v) => (v.kind === "dynamic" ? null : toNumber(v.gross)),
        align: "end",
        render: ProductPriceCell,
    })
    registerValueKind("productAvailability", {
        format: (v) => v?.text ?? "",
        sortValue: (v) => v?.text ?? null,
        render: ProductAvailabilityCell,
    })
}

const TYPE_ICON: Record<string, LucideIcon> = {
    STORABLE: Boxes,
    CONSUMABLE: Package,
    SERVICE: Wrench,
    SUBSCRIPTION: Repeat,
    MANUFACTURABLE: Factory,
}

/** The catalog is a sales surface: what matters is whether the product can be sold at all. */
const saleRestriction = (p: Product): string | null => {
    if (p.can_be_sold) return null
    return p.can_be_purchased ? "Solo compra" : "No disponible"
}

/** In a card the icon and green tone already say "available"; the word only eats width. */
const availabilityForCard = (p: Product): CardAvailability | null => {
    const line = getAvailability(p, { isDisabled: false })
    return line ? { ...line, text: line.text.replace(/ disponibles$/, "") } : null
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerInventoryValueKinds()

/** Product — one of the two most rigid screens (22 inline columns, 2 computed, renderCard with image). */
export const productEntity = defineEntity<Product>()((f) => ({
    label: "inventory.product",
    fields: {
        internalCode: f.code((p) => p.internal_code || p.code, { label: "Código interno", orderBy: "internal_code" }),
        sku: f.text("code", { label: "SKU", tone: "secondary", orderBy: "code" }),
        name: f.text("name", { label: "Nombre", orderBy: "name" }),
        category: f.text("category_name", { label: "Categoría", tone: "secondary", orderBy: "category__name" }),
        type: f.tags((p) => [p.product_type], { label: "Tipo", domain: "product_type", orderBy: "product_type" }),
        // Services carry no stock: "—" instead of "0 Unidad".
        stock: f.quantity((p) => (p.product_type === "SERVICE" ? null : p.current_stock), { label: "Stock", uom: (p) => p.uom_name, orderBy: "annotated_current_stock" }),
        // The card and the table share the gross amount; templates price from their cheapest variant.
        price: f.value("productPrice", (p) => {
            const price = getPrice(p)
            return {
                kind: price.kind,
                gross: price.kind === "fixed" && p.sale_price_gross != null ? p.sale_price_gross : price.gross,
                unit: price.unit,
            }
        }, { label: "Precio c/IVA", sortable: false }), // shown gross or dynamic; the server can only sort by the net sale_price
        availabilityLine: f.value("productAvailability", availabilityForCard, { label: "Disponibilidad", sortable: false }),
    },
}))

export const productViews = productEntity.views({
    table: { columns: ["internalCode", "name", "sku", "category", "type", "stock", "price"], primary: "name", defaultSort: "name" },
    card: {
        code: "internalCode",
        title: "name",
        // Stock health with icon and tone. The commercial slot is the footer: price, or the channel
        // restriction when the product is not for sale.
        highlights: ["availabilityLine"],
        footer: {
            value: "price",
            visible: (p) => p.can_be_sold !== false,
            fallback: { caption: "Canal", value: saleRestriction },
        },
        muted: (p) => !p.is_active,
        media: {
            placement: "top",
            iconFor: (p) => TYPE_ICON[p.product_type] ?? Package,
            image: (p) => resolveMediaUrl(p.image_thumbnail ?? p.image ?? null),
            // The category rides on the media like in the POS; an archived product says so instead.
            badge: (p) => (p.is_active ? p.category_name : "Archivado"),
            footnote: (p) => (p.has_variants && (p.variants_count ?? 0) > 0 ? variantChipLabel(p.variants_count ?? 0, p.variant_axis_label) : null),
            footnoteIcon: Layers,
        },
    },
})
