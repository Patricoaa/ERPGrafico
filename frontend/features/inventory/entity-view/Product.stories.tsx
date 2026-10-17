import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Collection, useEntityCollection, type CollectionSource } from "@/components/entity-view"
import { withEntityView } from "@/components/entity-view/stories/withEntityView"
import type { Product } from "../types"
import { productEntity, productViews } from "./product.entity"

const base = {
    category_id: 1,
    total_stock: 0,
    purchase_uom_name: "Unidad",
} as const

const PRODUCTS = [
    { ...base, id: 1, code: "PAP-COU-150", internal_code: "P-0001", name: "Papel couché 150 g", product_type: "STORABLE", category_name: "Papeles", sale_price: "1000", sale_price_gross: "1190", current_stock: 1250, uom_name: "Hoja", can_be_sold: true, can_be_purchased: true, image: null },
    { ...base, id: 2, code: "TIN-CMYK-K", internal_code: "P-0002", name: "Tinta proceso K100", product_type: "CONSUMABLE", category_name: "Tintas", sale_price: "18000", sale_price_gross: "21420", current_stock: 6.5, uom_name: "Kg", can_be_sold: false, can_be_purchased: true, image: null },
    { ...base, id: 3, code: "SRV-DIS", internal_code: "P-0003", name: "Diseño de pieza gráfica", product_type: "SERVICE", category_name: "Servicios", sale_price: "0", sale_price_gross: "0", current_stock: 0, uom_name: "Unidad", can_be_sold: true, can_be_purchased: false, is_dynamic_pricing: true, image: null },
    { ...base, id: 4, code: "TAR-VIS", internal_code: "P-0004", name: "Tarjetas de visita 4/4", product_type: "MANUFACTURABLE", category_name: "Impresos", sale_price: "25000", sale_price_gross: "29750", current_stock: 0, uom_name: "Millar", can_be_sold: true, can_be_purchased: false, image: null },
] as unknown as Product[] // fixtures carry only the fields the views read

function ProductCollection({ source, defaultView }: { source: CollectionSource<Product>; defaultView?: "table" | "card" }) {
    const collection = useEntityCollection(productEntity, source, { defaultSort: productViews.table.defaultSort })
    return (
        <Collection.Root collection={collection} selection="bulk" defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={productViews.table} card={productViews.card} />
        </Collection.Root>
    )
}

const meta = {
    title: "Entity view/Productos (rígida)",
    component: ProductCollection,
    decorators: [withEntityView],
    args: { source: { rows: PRODUCTS } },
} satisfies Meta<typeof ProductCollection>
export default meta
type Story = StoryObj<typeof meta>

export const Table: Story = {}
export const Cards: Story = { args: { defaultView: "card" } }
export const Dark: Story = { args: { defaultView: "card" }, globals: { theme: "dark" } }
