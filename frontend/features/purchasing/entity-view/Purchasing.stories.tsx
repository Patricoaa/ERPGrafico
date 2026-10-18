import * as React from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Collection, CollectionModes, useEntityCollection } from "@/components/entity-view"
import { withEntityView } from "@/components/entity-view/stories/withEntityView"
import { purchaseNoteEntity, purchaseNoteViews } from "./purchaseNote.entity"
import type { Invoice } from "@/features/billing"
import type { PurchaseOrderAPI } from "../types"
import { purchaseOrderEntity, purchaseOrderViews } from "./purchaseOrder.entity"

const ORDERS = [
    { id: 201, number: "201", display_id: "OC-0201", supplier: 31, supplier_name: "Papelera del Sur Ltda.", warehouse_name: "Bodega central", status: "CONFIRMED", receiving_status: "PARTIAL", total: "2380000", pending_amount: 1380000, date: "2026-10-10", receipt_date: "2026-10-20", lines: [{}, {}, {}] },
    { id: 202, number: "202", display_id: "OC-0202", supplier: 32, supplier_name: "Tintas Pacífico SA", warehouse_name: null, status: "DRAFT", receiving_status: "PENDING", total: "428400", pending_amount: 428400, date: "2026-10-15", receipt_date: null, lines: [{}] },
] as unknown as PurchaseOrderAPI[] // fixtures carry only the fields the views read

const NOTES = [
    { id: 301, number: "1550", display_id: "FAC-1550", date: "2026-10-11", dte_type: "FACTURA", dte_type_display: "Factura", partner_name: "Papelera del Sur Ltda.", supplier_name: "Papelera del Sur Ltda.", total: "2380000", status: "POSTED", pending_amount: 1380000 },
    { id: 302, number: "88", display_id: "NC-0088", date: "2026-10-13", dte_type: "NOTA_CREDITO", dte_type_display: "Nota de crédito", partner_name: "Papelera del Sur Ltda.", supplier_name: "Papelera del Sur Ltda.", total: "119000", status: "POSTED", pending_amount: 0 },
] as unknown as Invoice[]

function Orders({ defaultView }: { defaultView?: "table" | "card" }) {
    const collection = useEntityCollection(purchaseOrderEntity, { rows: ORDERS })
    return (
        <Collection.Root collection={collection} selection="panel" defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={purchaseOrderViews.table} card={purchaseOrderViews.card} />
        </Collection.Root>
    )
}

function Notes({ defaultView }: { defaultView?: "table" | "card" }) {
    const collection = useEntityCollection(purchaseNoteEntity, { rows: NOTES })
    return (
        <Collection.Root collection={collection} selection="panel" defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={purchaseNoteViews.table} card={purchaseNoteViews.card} />
        </Collection.Root>
    )
}

/** Replaces the 881-line PurchasingOrdersClientView body: two typed modes, no casts, no duplicated note columns. */
function PurchasingScreen({ defaultView }: { defaultView?: "table" | "card" }) {
    const [mode, setMode] = React.useState<"orders" | "notes">("orders")
    return (
        <CollectionModes
            label="Documentos de compra"
            value={mode}
            onChange={setMode}
            modes={{
                orders: { label: "Órdenes", render: () => <Orders defaultView={defaultView} /> },
                notes: { label: "Notas", render: () => <Notes defaultView={defaultView} /> },
            }}
        />
    )
}

const meta = {
    title: "Entity view/Compras (la más rígida)",
    component: PurchasingScreen,
    decorators: [withEntityView],
} satisfies Meta<typeof PurchasingScreen>
export default meta
type Story = StoryObj<typeof meta>

export const Table: Story = {}
export const Cards: Story = { args: { defaultView: "card" } }
