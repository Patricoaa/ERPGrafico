import { render, screen, within, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { Truck } from "lucide-react"

import { EntityTrail } from "../EntityTrail"
import type { EntityNavigation } from "../EntityNavigationContext"

const navigation = (overrides: Partial<EntityNavigation> = {}): EntityNavigation => ({
    backLabel: "FAC-9",
    goBack: vi.fn(),
    trail: [
        { key: "sales.saleorder:1", label: "OV-1", onSelect: vi.fn() },
        { key: "billing.invoice:9", label: "FAC-9", onSelect: vi.fn() },
    ],
    currentLabel: "AS-441",
    module: null,
    ...overrides,
})

/** ADR-0100: migas del drill-down dentro del drawer superior de la pila. */
describe("EntityTrail", () => {
    it("renders an accessible trail with the current document as aria-current", () => {
        render(<EntityTrail navigation={navigation()} />)
        const nav = screen.getByRole("navigation", { name: "Ruta de documentos" })
        expect(within(nav).getByText("OV-1")).toBeInTheDocument()
        expect(within(nav).getByText("AS-441")).toHaveAttribute("aria-current", "page")
        expect(within(nav).queryByRole("button", { name: "AS-441" })).toBeNull()
    })

    it("pops to the clicked previous document", () => {
        const nav = navigation()
        render(<EntityTrail navigation={nav} />)
        fireEvent.click(within(screen.getByRole("navigation", { name: "Ruta de documentos" })).getByText("OV-1"))
        expect(nav.trail[0].onSelect).toHaveBeenCalledTimes(1)
        expect(nav.trail[1].onSelect).not.toHaveBeenCalled()
    })

    it("keeps a single back button for narrow screens", () => {
        const nav = navigation()
        render(<EntityTrail navigation={nav} />)
        fireEvent.click(screen.getByRole("button", { name: /Volver a FAC-9/ }))
        expect(nav.goBack).toHaveBeenCalledTimes(1)
    })

    it("summarises the oldest steps with an ellipsis when the trail is long", () => {
        const trail = ["A", "B", "C", "D", "E"].map((label, i) => ({ key: `k${i}`, label, onSelect: vi.fn() }))
        render(<EntityTrail navigation={navigation({ trail, currentLabel: "F" })} />)
        const nav = screen.getByRole("navigation", { name: "Ruta de documentos" })
        expect(within(nav).queryByText("A")).toBeNull()
        expect(within(nav).queryByText("B")).toBeNull()
        expect(within(nav).getByText("C")).toBeInTheDocument()
        expect(within(nav).getByTitle("A › B")).toBeInTheDocument()
    })

    it("shows the document's module as text only when provided", () => {
        const { rerender } = render(<EntityTrail navigation={navigation()} />)
        expect(screen.queryByText("Contabilidad")).toBeNull()
        rerender(<EntityTrail navigation={navigation({ module: { id: "accounting", label: "Contabilidad", icon: Truck } })} />)
        expect(screen.getByText("Contabilidad")).toBeInTheDocument()
        expect(screen.getByTitle("Este documento pertenece a Contabilidad")).toBeInTheDocument()
    })
})
