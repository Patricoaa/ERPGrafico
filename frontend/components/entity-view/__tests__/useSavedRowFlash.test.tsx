import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect, afterEach } from "vitest"
import React from "react"

import { RecentSaveProvider, type RecentSave } from "@/components/providers/EntityOpenerContext"
import { useSavedRowFlash } from "../surfaces/useSavedRowFlash"

function Probe({ ids }: { ids: readonly string[] }) {
    const flash = useSavedRowFlash("inventory.warehouse", ids)
    return <span>flash:{flash ?? "none"}</span>
}

const view = (value: RecentSave, ids: readonly string[]) => (
    <RecentSaveProvider value={value}><Probe ids={ids} /></RecentSaveProvider>
)
const idle: RecentSave = { saved: null, creating: [] }

afterEach(() => { vi.useRealTimers() })

/** ADR-0101: la lista resalta la fila que acaba de guardar una pestaña. */
describe("useSavedRowFlash", () => {
    it("highlights the edited row and clears it after a moment", () => {
        vi.useFakeTimers()
        const { rerender } = render(view(idle, ["1", "2"]))
        rerender(view({ saved: { label: "inventory.warehouse", id: 2, at: 1 }, creating: [] }, ["1", "2"]))
        expect(screen.getByText("flash:2")).toBeInTheDocument()
        act(() => { vi.advanceTimersByTime(3000) })
        expect(screen.getByText("flash:none")).toBeInTheDocument()
    })

    it("ignores saves of other entities and signals older than the list", () => {
        const old = { saved: { label: "inventory.warehouse", id: 1, at: 1 }, creating: [] }
        const { rerender } = render(view(old, ["1"]))
        expect(screen.getByText("flash:none")).toBeInTheDocument()
        rerender(view({ saved: { label: "contacts.contact", id: 1, at: 2 }, creating: [] }, ["1"]))
        expect(screen.getByText("flash:none")).toBeInTheDocument()
    })

    it("after a creation, highlights the row that was not there when the panel opened", () => {
        const { rerender } = render(view(idle, ["1", "2"]))
        rerender(view({ saved: null, creating: ["inventory.warehouse"] }, ["1", "2"]))
        // El panel se cierra con el guardado; la fila nueva llega después, con el refetch.
        rerender(view({ saved: { label: "inventory.warehouse", id: null, at: 5 }, creating: [] }, ["1", "2"]))
        expect(screen.getByText("flash:none")).toBeInTheDocument()
        rerender(view({ saved: { label: "inventory.warehouse", id: null, at: 5 }, creating: [] }, ["3", "1", "2"]))
        expect(screen.getByText("flash:3")).toBeInTheDocument()
    })

    it("a cancelled creation does not highlight rows added later", () => {
        const { rerender } = render(view(idle, ["1"]))
        rerender(view({ saved: null, creating: ["inventory.warehouse"] }, ["1"]))
        rerender(view(idle, ["1"]))
        rerender(view({ saved: { label: "inventory.warehouse", id: null, at: 9 }, creating: [] }, ["1", "4"]))
        expect(screen.getByText("flash:none")).toBeInTheDocument()
    })
})
