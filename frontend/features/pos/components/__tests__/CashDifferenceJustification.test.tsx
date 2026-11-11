import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CashDifferenceBanner, CashDifferenceReasonChoice, TransferAccountChoice } from "../CashDifferenceJustification"

const reasons = [
    { value: "COUNTING_ERROR", label: "Error de Conteo", description: "Se contó mal" },
    { value: "TRANSFER", label: "Traspaso" },
]

describe("CashDifferenceBanner", () => {
    it("muestra faltante con signo y monto", () => {
        render(<CashDifferenceBanner diff={-5000} />)
        expect(screen.getByText("Falta efectivo")).toBeTruthy()
        expect(screen.getByText(/−\$5\.000/)).toBeTruthy()
    })

    it("muestra sobrante cuando la diferencia es positiva", () => {
        render(<CashDifferenceBanner diff={2000} />)
        expect(screen.getByText("Sobra efectivo")).toBeTruthy()
    })
})

describe("CashDifferenceReasonChoice", () => {
    it("ofrece los motivos como tarjetas de opción, sin menú desplegable", () => {
        const onChange = vi.fn()
        render(<CashDifferenceReasonChoice reasons={reasons} value="" onChange={onChange} />)
        fireEvent.click(screen.getByRole("radio", { name: /Error de Conteo/ }))
        expect(onChange).toHaveBeenCalledWith("COUNTING_ERROR")
        expect(screen.queryByRole("combobox")).toBeNull()
    })
})

describe("TransferAccountChoice", () => {
    const accounts = [
        { id: 1, name: "Caja chica", account_type: "CASH" as const, current_balance: 1000 },
        { id: 2, name: "Caja fuerte", account_type: "CASH" as const, current_balance: 90000 },
    ]

    it("deshabilita las cuentas sin saldo suficiente", () => {
        const onChange = vi.fn()
        render(<TransferAccountChoice label="Origen" accounts={accounts} value={null} minBalance={5000} onChange={onChange} />)
        const short = screen.getByRole("radio", { name: /Caja chica/ })
        expect(short.getAttribute("aria-disabled")).toBe("true")
        fireEvent.click(short)
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("radio", { name: /Caja fuerte/ }))
        expect(onChange).toHaveBeenCalledWith("2")
    })

    it("sin cuentas avisa en vez de mostrar una lista vacía", () => {
        render(<TransferAccountChoice label="Origen" accounts={[]} value={null} onChange={vi.fn()} />)
        expect(screen.getByText("No hay otras cuentas disponibles")).toBeTruthy()
    })
})
