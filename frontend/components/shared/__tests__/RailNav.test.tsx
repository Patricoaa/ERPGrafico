import { fireEvent, render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { Settings } from "lucide-react"

import { RailNav, railItemClass, type RailNavSection } from "../RailNav"

const sections: RailNavSection[] = [
    { label: "Cuenta", items: [{ value: "a", label: "Alfa", icon: Settings }, { value: "b", label: "Beta", badge: 3 }] },
    { items: [{ value: "c", label: "Gamma" }, { value: "d", label: "Delta", badge: 0 }] },
]

function setup(value = "a", onValueChange = vi.fn()) {
    render(
        <RailNav
            sections={sections}
            value={value}
            onValueChange={onValueChange}
            ariaLabel="Secciones de prueba"
            top={<div>slot-top</div>}
            bottom={<div>slot-bottom</div>}
        />,
    )
    return onValueChange
}

describe("RailNav", () => {
    it("renders section labels and items", () => {
        setup()
        expect(screen.getByText("Cuenta")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Alfa" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument()
        expect(screen.getByRole("navigation", { name: "Secciones de prueba" })).toBeInTheDocument()
    })

    it("marks the active item with aria-current=page", () => {
        setup("b")
        expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute("aria-current", "page")
        expect(screen.getByRole("button", { name: "Alfa" })).not.toHaveAttribute("aria-current")
    })

    it("calls onValueChange with the item value on click", () => {
        const onChange = setup()
        fireEvent.click(screen.getByRole("button", { name: "Gamma" }))
        expect(onChange).toHaveBeenCalledWith("c")
    })

    it("renders a numeric badge, including 0", () => {
        setup()
        expect(screen.getByText("3")).toBeInTheDocument()
        expect(screen.getByText("0")).toBeInTheDocument()
    })

    it("renders top and bottom slots", () => {
        setup()
        expect(screen.getByText("slot-top")).toBeInTheDocument()
        expect(screen.getByText("slot-bottom")).toBeInTheDocument()
    })

    it("railItemClass differentiates active from inactive", () => {
        expect(railItemClass(true)).toContain("bg-card")
        expect(railItemClass(false)).not.toContain("bg-card")
    })
})
