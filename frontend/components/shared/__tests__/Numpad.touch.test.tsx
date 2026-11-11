import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Numpad } from "../Numpad"

describe("Numpad · modo táctil", () => {
    it("sin decimales reemplaza el punto por una tecla de borrar", () => {
        const onChange = vi.fn()
        render(<Numpad value="125" onChange={onChange} allowDecimal={false} touch />)
        expect(screen.queryByRole("button", { name: "." })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Borrar último dígito" }))
        expect(onChange).toHaveBeenCalledWith("12")
    })

    it("hideConfirm quita el botón pero Enter sigue confirmando", () => {
        const onConfirm = vi.fn()
        render(<Numpad value="0" onChange={vi.fn()} onConfirm={onConfirm} confirmLabel="Continuar" hideConfirm touch />)
        expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull()
        fireEvent.keyDown(window, { key: "Enter" })
        expect(onConfirm).toHaveBeenCalled()
    })

    it("las teclas táctiles miden al menos 56px de alto", () => {
        render(<Numpad value="0" onChange={vi.fn()} allowDecimal={false} touch />)
        expect(screen.getByRole("button", { name: "5" }).className).toMatch(/h-16/)
    })
})
