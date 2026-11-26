import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditableCollection, defineEditable, defineEntity, type EditableRowValue } from "@/components/entity-view"

const touch = vi.hoisted(() => ({ on: true }))
vi.mock("@/hooks/useTouchMode", () => ({ useTouchMode: () => ({ isTouchMode: touch.on }) }))

interface Line { id: number; name: string; pending: number }
const entity = defineEntity<Line>()((f) => ({ title: "Prueba", fields: { name: f.text("name", { label: "Producto" }) } }))
const def = defineEditable(entity, {
    rowKey: (l) => l.id,
    context: ["name"],
    inputs: { qty: { kind: "quantity", header: "A despachar", label: (l) => `Cantidad — ${l.name}`, max: (l) => l.pending, step: () => 1 } },
})
const ROWS: Line[] = [{ id: 1, name: "Papel", pending: 6 }]
const VALUE: EditableRowValue[] = [{ key: "1", values: { qty: 0 } }]

describe("EditableCollection · numpad in touch mode (ADR-0087 amendment)", () => {
    it("opens the numpad on tap, fills the cap with «Máximo» and writes the value on confirm", async () => {
        touch.on = true
        const onChange = vi.fn()
        render(<EditableCollection definition={def} rows={ROWS} value={VALUE} onChange={onChange} label="Despacho" numpad />)

        const cell = screen.getByRole("spinbutton", { name: "Cantidad — Papel" })
        expect(cell).toHaveAttribute("readonly")
        await userEvent.click(cell)

        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText(/Máximo permitido: 6/)).toBeInTheDocument()
        await userEvent.click(within(dialog).getByRole("button", { name: "Máximo" }))
        await userEvent.click(within(dialog).getByRole("button", { name: "CONFIRMAR" }))
        expect(onChange).toHaveBeenCalledWith([{ key: "1", values: { qty: 6 } }])
    })

    it("types normally outside touch mode, or when the collection does not ask for the numpad", () => {
        touch.on = false
        const { unmount } = render(<EditableCollection definition={def} rows={ROWS} value={VALUE} onChange={vi.fn()} label="Despacho" numpad />)
        expect(screen.getByRole("spinbutton", { name: "Cantidad — Papel" })).not.toHaveAttribute("readonly")
        unmount()
        touch.on = true
        render(<EditableCollection definition={def} rows={ROWS} value={VALUE} onChange={vi.fn()} label="Despacho" />)
        expect(screen.getByRole("spinbutton", { name: "Cantidad — Papel" })).not.toHaveAttribute("readonly")
    })
})
