import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { productEntity, productViews } from "@/features/inventory/entity-view/product.entity"
import type { Product } from "@/features/inventory/types"
import { withEntityView } from "./withEntityView"

/**
 * Pilot of the catalog template on the real product entity (ADR-0097): centred 80px media band
 * with the category and variant chips stacked at its top-left, code, name, stock health, and a
 * commercial footer (price with unit, or the channel restriction when the product is not for sale).
 */
const meta = {
    title: "Entity View/Product catalog card",
    decorators: [withEntityView],
    parameters: { layout: "padded" },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const BASE: Product = {
    id: 0, code: "", internal_code: "", name: "", product_type: "STORABLE", category_id: 1, category_name: "Insumos",
    sale_price: "0", sale_price_gross: "0", current_stock: 0, total_stock: 0, uom_name: "Unidad", purchase_uom_name: "Unidad",
    track_inventory: true, can_be_sold: true, can_be_purchased: true, is_active: true,
}
const p = (o: Partial<Product>): Product => ({ ...BASE, ...o })

const ROWS: Product[] = [
    p({ id: 1, internal_code: "INS-0005", name: "Plancha Offset GTO 510×400", sale_price: "3781", sale_price_gross: "4500", current_stock: 5420, qty_available: 5420, uom_name: "Plancha" }),
    p({ id: 2, internal_code: "INS-0007", name: "Papel Couché Brillante 150 g", category_name: "Papeles", sale_price: "0", sale_price_gross: "0", min_variant_price: "168", current_stock: 0, qty_available: 0, uom_name: "Pliego", has_variants: true, variants_count: 4, variant_axis_label: "Gramaje" }),
    p({ id: 3, internal_code: "SRV-0004", name: "Corte por Guillotina", category_name: "Servicios Gráficos", product_type: "SERVICE", sale_price: "420", sale_price_gross: "500", uom_name: "Corte" }),
    p({ id: 4, internal_code: "SRV-0009", name: "Impresión Digital Color", category_name: "Servicios Gráficos", product_type: "SERVICE", is_dynamic_pricing: true, uom_name: "Hoja" }),
    p({ id: 5, internal_code: "MNT-0001", name: "Mantención Preventiva Offset Heidelberg", category_name: "Mantención", product_type: "SERVICE", can_be_sold: false, sale_price: "0", sale_price_gross: "0" }),
    p({ id: 6, internal_code: "INS-0011", name: "Tinta Cian Offset 1 kg", category_name: "Tintas", current_stock: 38, qty_available: 38, uom_name: "kg", sale_price: "21000", sale_price_gross: "24990", can_be_sold: false }),
    p({ id: 7, internal_code: "INS-0002", name: "Barniz UV Brillo (L)", category_name: "Insumos", is_active: false, current_stock: 12, qty_available: 12, uom_name: "Litro", sale_price: "15546", sale_price_gross: "18500" }),
    p({ id: 8, internal_code: "TRB-0003", name: "Tarjetas Personales 1000 un", category_name: "Impresos", product_type: "MANUFACTURABLE", has_bom: true, manufacturable_quantity: 12, requires_advanced_manufacturing: true, sale_price: "21008", sale_price_gross: "25000", uom_name: "Millar" }),
]

const kebab = () => (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Acciones">
        <MoreVertical className="size-4" />
    </Button>
)

function Catalog() {
    const collection = useEntityCollection(productEntity, { rows: ROWS })
    return (
        <Collection.Root collection={collection} defaultView="card" label="Productos" selection="bulk" actions={kebab}>
            <Collection.View card={productViews.card} />
        </Collection.Root>
    )
}

/** Stock states, a template with variants, services, dynamic price, an unusual channel and an archived product. */
export const Pilot: Story = {
    render: () => (
        <div className="w-[72rem]">
            <Catalog />
        </div>
    ),
}
