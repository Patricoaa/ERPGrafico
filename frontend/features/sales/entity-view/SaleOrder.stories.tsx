import * as React from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { expect, userEvent, within } from "storybook/test"
import { Button } from "@/components/ui/button"
import {
    Collection,
    EditableCollection,
    editableSchema,
    initialEditableValues,
    editableErrorsFromForm,
    useEntityCollection,
} from "@/components/entity-view"
import { withEntityView } from "@/components/entity-view/stories/withEntityView"
import { deliveryLinesEditable, orderLineEntity, orderLineViews } from "@/features/orders/entity-view/orderLine.entity"
import type { OrderLine } from "@/features/orders/types"
import type { SaleOrder } from "../types"
import { saleOrderEntity, saleOrderViews } from "./saleOrder.entity"

const LINES: OrderLine[] = [
    { id: 11, product: 1, product_name: "Papel couché 150 g", uom_name: "Hoja", quantity: 1000, quantity_delivered: 400, price_unit: 1190, unit_price_net: 1000, subtotal: 1190000, subtotal_net: 1000000 },
    { id: 12, product: 4, product_name: "Tarjetas de visita 4/4", uom_name: "Millar", quantity: 5, quantity_delivered: 0, price_unit: 29750, unit_price_net: 25000, subtotal: 148750, subtotal_net: 125000, requires_advanced_manufacturing: true, work_order_summary: { id: 77, status: "IN_PROGRESS", display_id: "OT-0077" } },
    { id: 13, product: 3, product_name: "Diseño de pieza gráfica", uom_name: "Unidad", quantity: 1, quantity_delivered: 1, price_unit: 59500, unit_price_net: 50000, subtotal: 59500, subtotal_net: 50000 },
    { id: 14, product: 9, product_name: "Volantes 1/0 carta", uom_name: "Millar", quantity: 3, quantity_delivered: 0, price_unit: 35700, unit_price_net: 30000, subtotal: 107100, subtotal_net: 90000, requires_advanced_manufacturing: true },
]

const ORDERS = [
    { id: 101, number: "101", display_id: "OV-0101", customer: 5, customer_name: "Imprenta Austral SpA", date: "2026-10-14", status: "CONFIRMED", total: 1505350, total_net: 1265000, total_paid: 500000, pending_amount: 1005350, channel_display: "Mesón", delivery_status: "PARTIAL", payment_status: "PARTIAL", lines: LINES },
    { id: 102, number: "102", display_id: "OV-0102", customer: 8, customer_name: "Colegio Los Andes", date: "2026-10-15", status: "DRAFT", total: 238000, total_net: 200000, total_paid: 0, pending_amount: 238000, channel_display: "Web", delivery_status: "PENDING", payment_status: "UNPAID", lines: LINES.slice(0, 1) },
    { id: 103, number: "103", display_id: "OV-0103", customer: 9, customer_name: "Municipalidad de Talca", date: "2026-10-16", status: "CANCELLED", total: 0, total_net: 0, total_paid: 0, pending_amount: 0, channel_display: "Mesón", delivery_status: "PENDING", payment_status: "UNPAID", lines: [] },
] as unknown as SaleOrder[] // fixtures carry only the fields the views read

function SaleOrderCollection({ defaultView }: { defaultView?: "table" | "card" }) {
    const [selectedId, setSelectedId] = React.useState<number | null>(null)
    const collection = useEntityCollection(saleOrderEntity, { rows: ORDERS }, { defaultSort: saleOrderViews.table.defaultSort })
    return (
        <Collection.Root collection={collection} selection="panel" selectedId={selectedId} onOpen={(o) => setSelectedId(o.id)} defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={saleOrderViews.table} card={saleOrderViews.card} />
        </Collection.Root>
    )
}

function OrderLines({ purchase = false }: { purchase?: boolean }) {
    const collection = useEntityCollection(orderLineEntity, { rows: LINES }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label="Productos de la orden">
            <Collection.View table={purchase ? orderLineViews.purchase : orderLineViews.sale} />
        </Collection.Root>
    )
}

function DeliveryForm() {
    const schema = React.useMemo(() => z.object({ lines: editableSchema(deliveryLinesEditable, LINES) }), [])
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { lines: initialEditableValues(deliveryLinesEditable, LINES) },
    })
    const [submitted, setSubmitted] = React.useState<string | null>(null)
    const lines = form.watch("lines")
    const errors = editableErrorsFromForm(form.formState.errors.lines, lines)
    return (
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => setSubmitted(JSON.stringify(v.lines)))}>
            <Controller
                control={form.control}
                name="lines"
                render={({ field }) => (
                    <EditableCollection definition={deliveryLinesEditable} rows={LINES} value={field.value} onChange={field.onChange} errors={errors} label="Cantidades a despachar" />
                )}
            />
            <div className="flex justify-end">
                <Button type="submit">Confirmar despacho</Button>
            </div>
            {submitted && <output className="text-xs text-muted-foreground">Enviado: {submitted}</output>}
        </form>
    )
}

const meta = {
    title: "Entity view/OV (documental)",
    component: SaleOrderCollection,
    decorators: [withEntityView],
} satisfies Meta<typeof SaleOrderCollection>
export default meta
type Story = StoryObj<typeof meta>

export const Table: Story = {}
export const Cards: Story = { args: { defaultView: "card" } }
export const Dark: Story = { args: { defaultView: "card" }, globals: { theme: "dark" } }

/** Lines in the document sheet: references via the documents extension, footer total, OC without the OT column. */
export const Lines: Story = { render: () => <OrderLines /> }
export const PurchaseLines: Story = { render: () => <OrderLines purchase /> }

/** P1 "quantity to process per line" as a declared editable surface inside an RHF + zod form. */
export const DeliveryEditable: Story = {
    render: () => <DeliveryForm />,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const paper = canvas.getByRole("spinbutton", { name: "Cantidad a despachar — Papel couché 150 g" })
        await userEvent.clear(paper)
        await userEvent.type(paper, "700")
        await userEvent.click(canvas.getByRole("button", { name: "Confirmar despacho" }))
        await expect(await canvas.findByRole("alert")).toHaveTextContent("Máx. 600,00")
        await expect(canvas.getByRole("spinbutton", { name: /Volantes/ })).toBeDisabled()
    },
}
