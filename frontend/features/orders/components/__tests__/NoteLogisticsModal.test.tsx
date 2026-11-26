import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NoteLogisticsModal } from "../NoteLogisticsModal"
import type { Order } from "../../types"

const processLogistics = vi.fn()
const toastError = vi.fn<(message: string) => void>()
const fresh = {
    id: 5,
    lines: [
        { product_id: 10, product_name: "Papel", quantity: 6, quantity_delivered: 2, uom_name: "Unidad" },
        { product_id: 11, product_name: "Tinta", quantity: 1, quantity_delivered: 1 },
    ],
}

vi.mock("../../hooks/useOrdersMutations", () => ({ useProcessLogistics: () => ({ processLogistics }) }))
vi.mock("../../hooks/useNoteLogisticsData", () => ({
    useNoteLogisticsData: () => ({ warehouses: [{ id: 1, name: "Central" }], invoice: fresh, isLoading: false }),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-26" }) }))
vi.mock("@/hooks/usePeriodValidation", () => ({
    usePeriodValidation: () => ({ validatePeriod: vi.fn(), validatePeriodImmediate: vi.fn(), clearPeriodValidation: vi.fn(), isValidating: false, isClosed: false, message: null }),
}))
vi.mock("sonner", () => ({ toast: { error: (message: string) => toastError(message), success: vi.fn() } }))

const invoice = { id: 5, sale_order: 3, dte_type: "NOTA_DEBITO", display_id: "ND-1", partner_name: "Cliente" } as unknown as Order

describe("NoteLogisticsModal on EditableCollection", () => {
    it("starts with the pending quantity, marks lines without pending and blocks a quantity over the cap", () => {
        render(<NoteLogisticsModal open onOpenChange={vi.fn()} invoice={invoice} />)

        const papel = screen.getByRole("spinbutton", { name: "Cantidad a procesar — Papel" })
        expect(papel).toHaveValue(4)
        expect(screen.getByText("Sin pendiente")).toBeInTheDocument()

        fireEvent.change(papel, { target: { value: "5" } })
        expect(screen.getByRole("alert")).toHaveTextContent("Máx. 4")

        fireEvent.click(screen.getByRole("button", { name: /Confirmar movimiento/i }))
        expect(toastError).toHaveBeenCalledWith("Hay cantidades que superan lo pendiente")
        expect(processLogistics).not.toHaveBeenCalled()
    })
})
