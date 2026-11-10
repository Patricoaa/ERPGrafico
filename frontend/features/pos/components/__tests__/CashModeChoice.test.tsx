import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CashModeChoice } from "../CashModeChoice"

describe("CashModeChoice", () => {
    it("muestra las dos opciones con la elegida marcada", () => {
        render(<CashModeChoice value="SINGLE" onChange={vi.fn()} />)
        expect(screen.getByRole("radiogroup", { name: "Modo de caja" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: /Un solo usuario/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /Multiusuario/ }).getAttribute("aria-checked")).toBe("false")
    })

    it("elegir Multiusuario avisa el cambio", () => {
        const onChange = vi.fn()
        render(<CashModeChoice value="SINGLE" onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: /Multiusuario/ }))
        expect(onChange).toHaveBeenCalledWith("MULTI")
    })
})
