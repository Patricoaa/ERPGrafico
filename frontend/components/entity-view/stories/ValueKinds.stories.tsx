import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Collection, defineEntity, useEntityCollection } from "@/components/entity-view"
import { withEntityView } from "./withEntityView"

/** One row per edge case: null, 0, negative, empty strings and arrays (invariant #8, Phase 8 matrix). */
interface Sample {
    id: number
    label: string
    amount: number | null
    qty: string | null
    date: string | null
    datetime: string | null
    flowIn: boolean
    tags: string[]
    progress: { done: number; total: number } | null
    status: string | null
}

const sampleEntity = defineEntity<Sample>()((f) => ({
    label: "test.sample",
    fields: {
        label: f.text("label", { label: "Caso" }),
        money: f.money("amount", { label: "Dinero" }),
        flow: f.flow("amount", { label: "Flujo", direction: (s) => (s.flowIn ? "inflow" : "outflow") }),
        qty: f.quantity("qty", { label: "Cantidad", uom: "kg", decimals: 2 }),
        date: f.date("date", { label: "Fecha" }),
        datetime: f.date("datetime", { label: "Fecha y hora", time: true }),
        range: f.dateRange((s) => (s.date ? { from: s.date, to: "2026-10-31" } : null), { label: "Período" }),
        status: f.status((s) => (s.status ? { status: s.status } : null), { label: "Estado" }),
        tags: f.tags("tags", { label: "Tags" }),
        progress: f.progress("progress", { label: "Progreso" }),
        ratio: f.progress("progress", { label: "Cuotas", format: "ratio" }),
    },
}))

const ROWS: Sample[] = [
    { id: 1, label: "Valores normales", amount: 125000, qty: "1250.5", date: "2026-10-01", datetime: "2026-10-01T14:35:00", flowIn: true, tags: ["Venta", "Compra"], progress: { done: 3, total: 4 }, status: "PAID" },
    { id: 2, label: "Ceros", amount: 0, qty: "0", date: "2026-01-01", datetime: null, flowIn: false, tags: [], progress: { done: 0, total: 4 }, status: "DRAFT" },
    { id: 3, label: "Negativos", amount: -48000, qty: "-2", date: null, datetime: null, flowIn: false, tags: ["Ajuste"], progress: { done: 4, total: 4 }, status: "CANCELLED" },
    { id: 4, label: "Ausentes", amount: null, qty: null, date: null, datetime: null, flowIn: true, tags: [], progress: null, status: null },
]

const views = sampleEntity.views({
    table: { columns: ["label", "money", "flow", "qty", "date", "datetime", "range", "status", "tags", "progress", "ratio"] },
    card: { title: "label", subtitle: ["date"], meta: ["qty", "ratio"], trailing: ["status", "money"], body: { kind: "progress", field: "progress" } },
})

function Matrix({ defaultView }: { defaultView?: "table" | "card" }) {
    const collection = useEntityCollection(sampleEntity, { rows: ROWS }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label="Matriz de tipos de valor" defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={views.table} card={views.card} />
        </Collection.Root>
    )
}

const meta = {
    title: "Entity view/Tipos de valor (matriz)",
    component: Matrix,
    decorators: [withEntityView],
} satisfies Meta<typeof Matrix>
export default meta
type Story = StoryObj<typeof meta>

export const Table: Story = {}
export const Cards: Story = { args: { defaultView: "card" } }
export const Dark: Story = { globals: { theme: "dark" } }
