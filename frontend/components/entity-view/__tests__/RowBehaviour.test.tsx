import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { DndContext } from "@dnd-kit/core"
import type { RowSelectionState } from "@tanstack/react-table"
import { Collection, defineEntity, useEntityCollection, type CollectionOptions, type FieldId } from "@/components/entity-view"

// Radix Select in jsdom.
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

interface Line {
    id: number
    name: string
    flag: "suggested" | "excluded" | null
}

const entity = defineEntity<Line>()((f) => ({
    title: "Líneas",
    fields: { name: f.text("name", { label: "Nombre" }) },
}))
type Id = FieldId<typeof entity.fields>
const views = entity.views({ table: { columns: ["name"] } })

const rows: Line[] = [
    { id: 1, name: "Uno", flag: "suggested" },
    { id: 2, name: "Dos", flag: "excluded" },
    { id: 3, name: "Tres", flag: null },
]

function Harness({ options, children }: { options?: CollectionOptions<Id, Line>; children?: React.ReactNode }) {
    const collection = useEntityCollection(entity, { rows }, { pagination: { mode: "none" }, ...options })
    return (
        <Collection.Root collection={collection} selection="bulk" label="Líneas">
            <Collection.View table={views.table} />
            {children}
        </Collection.Root>
    )
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement

describe("row behaviour (ADR-0159)", () => {
    it("tints rows by semantic tone", () => {
        render(<Harness options={{ rowTone: (r) => (r.flag === "suggested" ? "attention" : r.flag === "excluded" ? "muted" : null) }} />)
        expect(rowOf("Uno")).toHaveAttribute("data-tone", "attention")
        expect(rowOf("Dos")).toHaveAttribute("data-tone", "muted")
        expect(rowOf("Tres")).not.toHaveAttribute("data-tone")
    })

    it("reads and writes a controlled selection keyed by row id", async () => {
        const onChange = vi.fn<(next: RowSelectionState) => void>()
        render(<Harness options={{ selection: { state: { "2": true }, onChange } }} />)
        expect(within(rowOf("Dos")).getByRole("checkbox")).toBeChecked()
        await userEvent.click(within(rowOf("Tres")).getByRole("checkbox"))
        expect(onChange).toHaveBeenLastCalledWith({ "2": true, "3": true })
    })

    it("applies a dock choice to the selected rows and clears the selection", async () => {
        const onChoose = vi.fn()
        render(
            <Harness>
                <Collection.BulkBar<Line> choice={{ label: "Asignar categoría", options: [{ value: "A", label: "Activo" }], onChoose }} />
            </Harness>,
        )
        await userEvent.click(within(rowOf("Uno")).getByRole("checkbox"))
        await userEvent.click(screen.getByRole("combobox", { name: "Asignar categoría" }))
        await userEvent.click(await screen.findByRole("option", { name: "Activo" }))
        expect(onChoose).toHaveBeenCalledWith([rows[0]], "A")
        expect(within(rowOf("Uno")).getByRole("checkbox")).not.toBeChecked()
    })

    it("makes rows draggable when the collection declares a drag spec", () => {
        render(
            <DndContext>
                <Harness options={{ dnd: { drag: (r) => (r.flag === "excluded" ? null : { id: `line-${r.id}`, data: { id: r.id } }) } }} />
            </DndContext>,
        )
        expect(rowOf("Uno")).toHaveAttribute("aria-roledescription", "draggable")
        expect(rowOf("Dos")).not.toHaveAttribute("aria-roledescription")
    })
})
