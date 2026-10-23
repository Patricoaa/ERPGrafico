import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Collection, EntityViewProvider, useEntityCollection } from "@/components/entity-view"
import { productEntity, productViews } from "../product.entity"
import type { Product } from "../../types"

const BASE: Product = {
    id: 0,
    code: "",
    internal_code: "",
    name: "",
    product_type: "STORABLE",
    category_id: 1,
    category_name: "Insumos",
    sale_price: "0",
    sale_price_gross: "0",
    current_stock: 0,
    total_stock: 0,
    uom_name: "Unidad",
    purchase_uom_name: "Unidad",
    track_inventory: true,
    can_be_sold: true,
    can_be_purchased: true,
    is_active: true,
}

const product = (overrides: Partial<Product>): Product => ({ ...BASE, ...overrides })

const ROWS: Product[] = [
    product({
        id: 1,
        internal_code: "INS-0005",
        name: "Plancha Offset GTO",
        sale_price: "3781",
        sale_price_gross: "4500",
        current_stock: 5420,
        qty_available: 5420,
        uom_name: "Plancha",
    }),
    product({
        id: 2,
        internal_code: "MNT-0001",
        name: "Mantención Preventiva",
        product_type: "SERVICE",
        category_name: "Mantención",
        can_be_sold: false,
        sale_price: "0",
        sale_price_gross: "0",
    }),
    product({
        id: 3,
        internal_code: "PAP-0007",
        name: "Papel Couché Brillante",
        category_name: "Papeles",
        has_variants: true,
        variants_count: 4,
        variant_axis_label: "Gramaje",
        sale_price: "0",
        sale_price_gross: "0",
        min_variant_price: "7143",
        qty_available: 0,
    }),
    product({
        id: 4,
        internal_code: "SRV-0009",
        name: "Impresión Digital Color",
        product_type: "SERVICE",
        category_name: "Servicios Gráficos",
        is_dynamic_pricing: true,
    }),
    product({
        id: 5,
        internal_code: "INS-0002",
        name: "Barniz UV Brillo",
        category_name: "Insumos",
        is_active: false,
        qty_available: 12,
    }),
]

function Harness() {
    const collection = useEntityCollection(productEntity, { rows: ROWS })
    return (
        <EntityViewProvider opener={{ open: vi.fn(), labelOf: () => undefined }}>
            <Collection.Root
                collection={collection}
                defaultView="card"
                label="Productos"
                selection="none"
                actions={() => <button type="button">Acciones</button>}
            >
                <Collection.View card={productViews.card} />
            </Collection.Root>
        </EntityViewProvider>
    )
}

function cards() {
    return within(screen.getByRole("list", { name: "Productos" })).getAllByRole("listitem")
}

describe("Product catalog card", () => {
    it("centres the media and groups the category and variant chips at its top-left", () => {
        render(<Harness />)
        const [first, , template] = cards()
        const media = first.querySelector(".h-20") as HTMLElement
        expect(media).toHaveClass("h-20", "items-center", "justify-center")
        const chips = media.querySelector("[data-media-chips]") as HTMLElement
        expect(chips).toHaveClass("absolute", "left-2", "top-2", "flex-col", "gap-1")
        expect(within(chips).getByText("Insumos")).toBeInTheDocument()

        const templateChips = template.querySelector("[data-media-chips]") as HTMLElement
        expect(within(templateChips).getByText("Papeles")).toBeInTheDocument()
        expect(within(templateChips).getByText("4 gramajes")).toBeInTheDocument()
    })

    it("shows the stock status, and moves a non-saleable product's channel into the footer", () => {
        render(<Harness />)
        const [stock, purchaseOnly] = cards()
        expect(stock).toHaveTextContent(/5\.420 planchas/)
        expect(purchaseOnly).toHaveTextContent("Canal")
        expect(purchaseOnly).toHaveTextContent("Solo compra")
        expect(purchaseOnly).not.toHaveTextContent("Precio c/IVA")
    })

    it("prices templates from their cheapest variant and labels dynamic pricing", () => {
        render(<Harness />)
        const [, , template, dynamic] = cards()
        expect(template).toHaveTextContent("desde")
        expect(template).toHaveTextContent("8.500")
        expect(dynamic).toHaveTextContent("Precio dinámico")
    })

    it("keeps the title as a plain opener and marks archived products", () => {
        render(<Harness />)
        const [first, , , , archived] = cards()
        const open = within(first).getByRole("button", { name: "Plancha Offset GTO" })
        expect(open.className).toContain("hover:no-underline")
        expect(open.className).not.toContain("focus-visible:underline")
        expect(archived).toHaveTextContent("Archivado")
        expect(archived.firstElementChild).toHaveClass("opacity-70")
    })
})
