import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PeriodControl } from "../PeriodControl"
import { PERIOD_OPTIONS } from "../period"

describe("PeriodControl", () => {
    it("renderiza un botón por período", () => {
        render(<PeriodControl value="12m" onChange={vi.fn()} />)
        for (const option of PERIOD_OPTIONS) {
            expect(screen.getByRole("radio", { name: option.label })).toBeInTheDocument()
        }
    })

    it("marca el período activo", () => {
        render(<PeriodControl value="6m" onChange={vi.fn()} />)
        expect(screen.getByRole("radio", { name: "6 m" })).toHaveAttribute("data-state", "on")
        expect(screen.getByRole("radio", { name: "3 m" })).toHaveAttribute("data-state", "off")
    })

    it("notifica el período elegido", () => {
        const onChange = vi.fn()
        render(<PeriodControl value="12m" onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: "6 m" }))
        expect(onChange).toHaveBeenCalledWith("6m")
    })

    it("ignora el clic sobre el período ya activo", () => {
        const onChange = vi.fn()
        render(<PeriodControl value="12m" onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: "12 m" }))
        expect(onChange).not.toHaveBeenCalled()
    })

    it("expone el grupo con el nombre Período", () => {
        render(<PeriodControl value="all" onChange={vi.fn()} />)
        expect(screen.getByRole("group", { name: "Período" })).toBeInTheDocument()
    })
})
