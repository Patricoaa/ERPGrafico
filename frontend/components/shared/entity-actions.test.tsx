import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { createEntityActions, toMenuItems } from "./entity-actions"

interface Item { id: number }

describe("createEntityActions — a lone action (closures code review)", () => {
    it("is named by its label, not the generic 'Abrir'", () => {
        const actions = createEntityActions<Item, object>(() => [{ action: "reopen", label: "Reabrir ejercicio", onClick: vi.fn() }])
        render(<>{actions.forCollection({})({ id: 1 }, "table")}</>)
        expect(screen.getByRole("button", { name: "Reabrir ejercicio" })).toBeInTheDocument()
    })

    it("falls back to the registry label", () => {
        const actions = createEntityActions<Item, object>(() => [{ action: "edit", onClick: vi.fn() }])
        render(<>{actions.render({ id: 1 }, {})}</>)
        expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
    })

    it("when disabled goes to the menu (which honours disabled) instead of the always-clickable arrow", () => {
        const items = [{ action: "post" as const, label: "Cerrar ejercicio", onClick: vi.fn(), disabled: true }]
        const actions = createEntityActions<Item, object>(() => items)
        render(<>{actions.forCollection({})({ id: 1 }, "table")}</>)
        expect(screen.queryByRole("button", { name: "Cerrar ejercicio" })).not.toBeInTheDocument()
        expect(toMenuItems(items)[0]).toMatchObject({ label: "Cerrar ejercicio", disabled: true })
    })
})
