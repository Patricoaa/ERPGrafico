import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FiscalMatchCandidateCard, type FiscalMatchCardData } from "../FiscalMatchCandidateCard"

const card = (over: Partial<FiscalMatchCardData> = {}): FiscalMatchCardData => ({
    id: 81,
    label: "Venta TUU #81",
    counterparty: "Caja 1",
    date: "2026-11-10",
    datetime: "2026-11-10T11:40:00-03:00",
    amount: "9990.00",
    score: 95,
    warnings: [],
    ...over,
})

describe("FiscalMatchCandidateCard", () => {
    it("muestra etiqueta, contraparte, total y el chip de coincidencia", () => {
        render(<FiscalMatchCandidateCard part="tuu" card={card()} state="idle" onToggle={vi.fn()} />)
        expect(screen.getByText("Venta TUU #81")).toBeInTheDocument()
        expect(screen.getByText("Caja 1")).toBeInTheDocument()
        expect(screen.getByText("95 % coincidencia")).toBeInTheDocument()
        expect(screen.getByText(/9\.990/)).toBeInTheDocument()
    })

    it("seleccionar con un clic; la tarjeta elegida se anuncia y lo dice en texto", async () => {
        const user = userEvent.setup()
        const onToggle = vi.fn()
        const { rerender } = render(<FiscalMatchCandidateCard part="rcv" card={card()} state="idle" onToggle={onToggle} />)
        await user.click(screen.getByRole("checkbox", { name: /Venta TUU #81/ }))
        expect(onToggle).toHaveBeenCalled()
        rerender(<FiscalMatchCandidateCard part="rcv" card={card()} state="selected" onToggle={onToggle} />)
        expect(screen.getByRole("checkbox", { name: /Venta TUU #81/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByText("Por unir")).toBeInTheDocument()
    })

    it("una advertencia bloqueante deshabilita la tarjeta con su motivo", async () => {
        const user = userEvent.setup()
        const onToggle = vi.fn()
        render(
            <FiscalMatchCandidateCard
                part="tuu"
                card={card({ warnings: [{ code: "TYPE_INCOMPATIBLE", label: "Efectivo solo en boletas", blocking: true }] })}
                state="idle"
                onToggle={onToggle}
            />,
        )
        const el = screen.getByRole("checkbox", { name: /Venta TUU #81/ })
        expect(el).toHaveAttribute("aria-disabled", "true")
        expect(screen.getByText("Efectivo solo en boletas")).toBeInTheDocument()
        await user.click(el)
        expect(onToggle).not.toHaveBeenCalled()
    })

    it("advertencias no bloqueantes como chips; la tarjeta sigue seleccionable", () => {
        render(
            <FiscalMatchCandidateCard
                part="rcv"
                card={card({ score: 55, warnings: [{ code: "OTHER_AMOUNT", label: "Otro monto", blocking: false }] })}
                state="idle"
                onToggle={vi.fn()}
            />,
        )
        expect(screen.getByText("Otro monto")).toBeInTheDocument()
        expect(screen.getByRole("checkbox", { name: /Venta TUU #81/ })).not.toHaveAttribute("aria-disabled")
    })

    it("registro unido: «Quitar», y en espera «Se quitará» con «Deshacer»", async () => {
        const user = userEvent.setup()
        const onRemove = vi.fn()
        const onUndo = vi.fn()
        const linked = card({ score: undefined })
        const { rerender } = render(<FiscalMatchCandidateCard part="rcv" card={linked} state="linked" onRemove={onRemove} onUndo={onUndo} />)
        expect(screen.queryByText(/coincidencia/)).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Quitar Venta TUU #81" }))
        expect(onRemove).toHaveBeenCalled()
        rerender(<FiscalMatchCandidateCard part="rcv" card={linked} state="toRemove" onRemove={onRemove} onUndo={onUndo} />)
        expect(screen.getByText("Se quitará")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Deshacer" }))
        expect(onUndo).toHaveBeenCalled()
    })

    it("error del guardado en la tarjeta", () => {
        render(<FiscalMatchCandidateCard part="rcv" card={card()} state="error" error="Pago ya tomado" onToggle={vi.fn()} />)
        expect(screen.getByRole("alert")).toHaveTextContent("Pago ya tomado")
    })

    it("solo lectura: sin selección ni «Quitar»", () => {
        render(<FiscalMatchCandidateCard part="rcv" card={card()} state="linked" readOnly onRemove={vi.fn()} onToggle={vi.fn()} />)
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument()
    })

    it("venta TUU elegida con varios pagos pide elegir el pago", () => {
        render(
            <FiscalMatchCandidateCard
                part="tuu"
                card={card()}
                state="selected"
                onToggle={vi.fn()}
                payment={{
                    options: [
                        { id: 7, amount: "9990.00", created_at: "2026-11-10T11:39:00-03:00", method: "Tarjeta" },
                        { id: 8, amount: "9990.00", created_at: "2026-11-10T12:10:00-03:00", method: "Efectivo" },
                    ],
                    value: null,
                    onChange: vi.fn(),
                }}
            />,
        )
        expect(screen.getByText("Elige el pago")).toBeInTheDocument()
    })
})
