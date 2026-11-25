import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ViewControl } from "../ViewControl"

const OPTIONS = [{ value: 30, label: "30 d" }, { value: 90, label: "90 d" }, { value: 180, label: "180 d" }] as const

describe("ViewControl", () => {
    it("names the group with its label and marks the active option", () => {
        render(<ViewControl label="Stock inmóvil desde" value={90} options={OPTIONS} onChange={vi.fn()} />)
        expect(screen.getByRole("radiogroup", { name: "Stock inmóvil desde" })).toBeInTheDocument()
        expect(screen.getByRole("radio", { name: "90 d" })).toHaveAttribute("data-state", "on")
    })

    it("notifies the typed value of the chosen option", () => {
        const onChange = vi.fn()
        render(<ViewControl label="Stock inmóvil desde" value={90} options={OPTIONS} onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: "30 d" }))
        expect(onChange).toHaveBeenCalledWith(30)
    })

    it("works with string values", () => {
        const onChange = vi.fn()
        render(
            <ViewControl
                label="Métrica" value="units" onChange={onChange}
                options={[{ value: "units", label: "Unidades" }, { value: "margin", label: "Margen" }]}
            />,
        )
        fireEvent.click(screen.getByRole("radio", { name: "Margen" }))
        expect(onChange).toHaveBeenCalledWith("margin")
    })

    it("ignores a click on the already active option", () => {
        const onChange = vi.fn()
        render(<ViewControl label="x" value={90} options={OPTIONS} onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: "90 d" }))
        expect(onChange).not.toHaveBeenCalled()
    })
})
