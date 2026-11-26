import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NoteLogisticsStep } from "../steps/NoteLogisticsStep"
import type { NoteLineItem, NoteLogisticsData } from "../../types"

vi.mock("@/features/inventory", () => ({
    useAllowedUoMsByProduct: () => new Map([["10", [{ id: 1, name: "Unidad" }, { id: 2, name: "Caja x12" }]]]),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-26" }) }))
vi.mock("@/hooks/usePeriodValidation", () => ({
    usePeriodValidation: () => ({ validatePeriod: vi.fn(), validatePeriodImmediate: vi.fn(), clearPeriodValidation: vi.fn(), isValidating: false, isClosed: false, message: null }),
}))

const line = (over: Partial<NoteLineItem>): NoteLineItem => ({
    lineId: 1, productId: 10, productName: "Papel", originalQuantity: 8, noteQuantity: 8, noteUnitPrice: 100, uomId: 1, uomName: "Unidad", createsStockMove: true, ...over,
})

const ITEMS = [
    line({}),
    line({ lineId: 2, productId: 20, productName: "Diseño", createsStockMove: false }),
]

const data: NoteLogisticsData = {
    warehouse_id: "1",
    date: "2026-11-26",
    delivery_type: "PARTIAL",
    line_data: [{ line_id: 1, product_id: 10, quantity: 8, uom_id: 1 }],
    notes: "",
}

describe("NoteLogisticsStep · partial lines on EditableCollection", () => {
    it("edits line_data from the collection and keeps ineligible lines out", () => {
        const setData = vi.fn()
        render(<NoteLogisticsStep isCreditNote data={data} setData={setData} selectedItems={ITEMS} />)

        expect(screen.getByText("Sin control de stock")).toBeInTheDocument()
        expect(screen.getByRole("spinbutton", { name: "Cantidad a procesar — Diseño" })).toBeDisabled()
        expect(screen.getByRole("combobox", { name: "Unidad — Papel" })).toHaveTextContent("Unidad")

        fireEvent.change(screen.getByRole("spinbutton", { name: "Cantidad a procesar — Papel" }), { target: { value: "3" } })
        expect(setData).toHaveBeenLastCalledWith({ ...data, line_data: [{ line_id: 1, product_id: 10, quantity: 3, uom_id: 1 }] })
    })

    it("shows the cap error of a line next to its cell", () => {
        render(<NoteLogisticsStep isCreditNote data={{ ...data, line_data: [{ line_id: 1, product_id: 10, quantity: 9, uom_id: 1 }] }} setData={vi.fn()} selectedItems={ITEMS} />)
        expect(screen.getByRole("alert")).toHaveTextContent("Máx.")
    })
})
