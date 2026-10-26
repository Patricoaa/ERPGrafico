import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MoreVertical, Package, Users, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collection, defineEntity, useEntityCollection } from "@/components/entity-view"
import { withEntityView } from "./withEntityView"

/**
 * Card grids of the family (ADR-0097): `item` role with a stretched-link title, the code line,
 * the pinned footer (amount, kebab) and the left state rail with the entity icon.
 */
const kebab = () => (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Acciones">
        <MoreVertical className="size-4" />
    </Button>
)
const meta = {
    title: "Entity View/Collection cards",
    decorators: [withEntityView],
    parameters: { layout: "padded" },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

interface Item {
    id: number
    sku: string
    name: string
    category: string
    kind: "goods" | "service"
    sale: string[]
    stock: string | null
    price: number
}

const itemEntity = defineEntity<Item>()((f) => ({
    label: "inventory.product",
    fields: {
        sku: f.code("sku", { label: "Código interno" }),
        name: f.text("name", { label: "Nombre" }),
        category: f.text("category", { label: "Categoría" }),
        sale: f.tags("sale", { label: "Disponible para" }),
        stock: f.quantity("stock", { label: "Stock", uom: "un", decimals: 0 }),
        price: f.money("price", { label: "Total (c/IVA)" }),
    },
}))
const itemViews = itemEntity.views({
    card: {
        code: "sku",
        title: "name",
        subtitle: ["category"],
        meta: ["sale", "stock"],
        footer: { value: "price" },
        media: { placement: "top", iconFor: (i) => (i.kind === "service" ? Wrench : Package) },
    },
})
const ITEMS: Item[] = [
    { id: 1, sku: "SRV-0004", name: "Corte por Guillotina", category: "Servicios Gráficos", kind: "service", sale: ["Venta", "Compra"], stock: null, price: 500 },
    { id: 2, sku: "INS-0005", name: "Plancha Offset GTO", category: "Insumos", kind: "goods", sale: ["Venta", "Compra"], stock: "5420", price: 4500 },
    { id: 3, sku: "MNT-0001", name: "Mantención Preventiva Offset Heidelberg", category: "Servicios de Mantención", kind: "service", sale: ["Compra"], stock: "0", price: 0 },
]

const MORE_ITEMS: Item[] = Array.from({ length: 7 }, (_, i) => ({
    ...ITEMS[i % ITEMS.length],
    id: 10 + i,
    sku: `INS-01${i}`,
}))

function ItemsGrid() {
    const collection = useEntityCollection(itemEntity, { rows: [...ITEMS, ...MORE_ITEMS] })
    return (
        <Collection.Root collection={collection} defaultView="card" label="Productos" selection="bulk" actions={kebab}>
            <Collection.View card={itemViews.card} />
        </Collection.Root>
    )
}

/** Catalog items: media on top, bulk checkbox in the top-right corner, price and kebab in the footer; 4-5 columns by width. */
export const Catalog: Story = {
    render: () => (
        <div className="w-[68rem]">
            <ItemsGrid />
        </div>
    ),
}

interface Doc {
    id: number
    folio: string
    customer: string
    date: string
    status: string
    lines: number
    total: number
    pending: number
}

const docEntity = defineEntity<Doc>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code("folio", { label: "Folio" }),
        customer: f.text("customer", { label: "Cliente" }),
        date: f.date("date", { label: "Fecha" }),
        status: f.status((d) => ({ status: d.status }), { label: "Estado" }),
        lines: f.number("lines", { label: "Líneas" }),
        total: f.money("total", { label: "Total" }),
        pending: f.money("pending", { label: "Pendiente" }),
    },
}))
const docViews = docEntity.views({
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["status"],
        rail: { status: (d) => d.status },
        body: { kind: "workflow", lines: "lines", total: "total", pending: "pending" },
    },
})
const DOCS: Doc[] = [
    { id: 1, folio: "OV-000171", customer: "Editorial Amanecer S.A.", date: "2026-10-22", status: "DRAFT", lines: 3, total: 860500, pending: 860500 },
    { id: 2, folio: "OV-000170", customer: "Imprenta Sur Ltda.", date: "2026-10-20", status: "PAID", lines: 1, total: 1240000, pending: 0 },
    { id: 3, folio: "OV-000169", customer: "Gráfica del Norte", date: "2026-10-18", status: "CANCELLED", lines: 2, total: 312900, pending: 0 },
]

function DocsGrid() {
    const collection = useEntityCollection(docEntity, { rows: DOCS })
    return (
        <Collection.Root collection={collection} defaultView="card" label="Documentos" actions={kebab}>
            <Collection.View card={docViews.card} />
        </Collection.Root>
    )
}

/** Documents: the rail on the left holds the entity icon and encodes the state; the kebab stays in the header. */
export const DocumentsWithRail: Story = {
    render: () => (
        <div className="w-[60rem]">
            <DocsGrid />
        </div>
    ),
}

const compactDocViews = docEntity.views({
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        meta: ["lines"],
        rail: { status: () => null, icon: Users },
    },
})

function CompactDocsGrid() {
    const collection = useEntityCollection(docEntity, { rows: DOCS })
    return (
        <Collection.Root collection={collection} defaultView="card" label="Documentos compactos" actions={kebab}>
            <Collection.View card={compactDocViews.card} />
        </Collection.Root>
    )
}

/** Compact document variant: no media band; a decorative identity icon rides the leading rail (Group). */
export const CompactDocument: Story = {
    render: () => (
        <div className="w-[48rem]">
            <CompactDocsGrid />
        </div>
    ),
}
