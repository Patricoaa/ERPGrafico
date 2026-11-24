import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Trash2 } from "lucide-react"
import { SummaryLine, SummaryLineList, SummaryMenu, SummaryPanelHeader, SummaryTotal } from "./SummaryPanel"

describe("SummaryPanel", () => {
    it("does not render the menu when every entry is hidden", () => {
        render(<SummaryMenu items={[{ id: "a", label: "Vaciar", icon: Trash2, hidden: true, onSelect: () => {} }]} />)
        expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull()
    })

    it("renders the menu trigger when at least one entry is visible", () => {
        render(<SummaryMenu items={[{ id: "a", label: "Vaciar", onSelect: () => {} }]} />)
        expect(screen.getByRole("button", { name: "Más acciones" })).toBeTruthy()
    })

    it("pluralizes the item count in the header", () => {
        const { rerender } = render(<SummaryPanelHeader title="Carrito" count={1} />)
        expect(screen.getByText("1 ítem")).toBeTruthy()
        rerender(<SummaryPanelHeader title="Carrito" count={3} />)
        expect(screen.getByText("3 ítems")).toBeTruthy()
    })

    it("shows the empty state instead of the lines", () => {
        render(<SummaryLineList isEmpty empty={<p>Vacío</p>}><SummaryLine name="x" total="$1" /></SummaryLineList>)
        expect(screen.getByText("Vacío")).toBeTruthy()
        expect(screen.queryByText("x")).toBeNull()
    })

    it("shows the total and a collapsible breakdown", () => {
        render(<SummaryTotal total="$53.850" breakdown={[{ label: "Neto", value: "$45.252" }]} />)
        expect(screen.getByText("$53.850")).toBeTruthy()
        expect(screen.getByText("Neto")).toBeTruthy()
    })
})
