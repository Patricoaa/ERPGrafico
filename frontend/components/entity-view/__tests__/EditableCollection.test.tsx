import * as React from "react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    EditableCollection,
    defineEditable,
    defineEntity,
    editableSchema,
    initialEditableValues,
    editableErrorsFromForm,
} from "@/components/entity-view"

interface Line {
    id: number
    name: string
    quantity: number
    delivered: number
    blocked: boolean
}

const entity = defineEntity<Line>()((f) => ({
    title: "Prueba",
    fields: {
        name: f.text("name", { label: "Producto" }),
        quantity: f.quantity("quantity", { label: "Cantidad" }),
    },
}))

const def = defineEditable(entity, {
    rowKey: (l) => l.id,
    context: ["name", "quantity"],
    inputs: {
        take: {
            kind: "quantity",
            header: "A despachar",
            label: (l) => `Cantidad a despachar — ${l.name}`,
            max: (l) => l.quantity - l.delivered,
            initial: (l) => l.quantity - l.delivered,
        },
    },
    eligible: (l) => (l.blocked ? { ok: false, reason: "Requiere producción" } : { ok: true }),
    bulk: ["fillToMax", "clear"],
})

const ROWS: Line[] = [
    { id: 1, name: "Papel", quantity: 10, delivered: 4, blocked: false },
    { id: 2, name: "Volantes", quantity: 3, delivered: 0, blocked: true },
]

function Form() {
    const schema = React.useMemo(() => z.object({ lines: editableSchema(def, ROWS) }), [])
    const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { lines: initialEditableValues(def, ROWS) } })
    const lines = form.watch("lines")
    const errors = editableErrorsFromForm(form.formState.errors.lines, lines)
    return (
        <form onSubmit={form.handleSubmit(() => undefined)}>
            <Controller
                control={form.control}
                name="lines"
                render={({ field }) => <EditableCollection definition={def} rows={ROWS} value={field.value} onChange={field.onChange} errors={errors} label="Despacho" />}
            />
            <Button type="submit">Enviar</Button>
        </form>
    )
}

describe("EditableCollection inside an RHF + zod form (P1)", () => {
    it("labels each input from its row and disables ineligible rows (AX-6, ED-3)", () => {
        render(<Form />)
        expect(screen.getByRole("spinbutton", { name: "Cantidad a despachar — Papel" })).toHaveValue(6)
        const blocked = screen.getByRole("spinbutton", { name: "Cantidad a despachar — Volantes" })
        expect(blocked).toBeDisabled()
        expect(blocked).toHaveAccessibleDescription("Requiere producción")
        expect(screen.getByRole("spinbutton", { name: "Cantidad a despachar — Papel" })).toHaveAccessibleDescription("Máx. 6,00")
    })

    it("shows the cap error next to the cell after submit (ED-2)", async () => {
        const user = userEvent.setup()
        render(<Form />)
        const input = screen.getByRole("spinbutton", { name: "Cantidad a despachar — Papel" })
        await user.clear(input)
        await user.type(input, "7")
        await user.click(screen.getByRole("button", { name: "Enviar" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Máx. 6,00")
        expect(input).toHaveAttribute("aria-invalid", "true")
    })

    it("fills to the cap and clears with the bulk helpers (ED-5)", async () => {
        const user = userEvent.setup()
        render(<Form />)
        const input = screen.getByRole("spinbutton", { name: "Cantidad a despachar — Papel" })
        await user.click(screen.getByRole("button", { name: "Limpiar" }))
        expect(input).toHaveValue(0)
        await user.click(screen.getByRole("button", { name: "Completar con el máximo" }))
        expect(input).toHaveValue(6)
    })
})
