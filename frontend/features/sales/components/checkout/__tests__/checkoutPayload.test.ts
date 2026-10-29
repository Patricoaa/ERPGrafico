import { describe, it, expect } from "vitest"
import { existingOrderPayload, canEditManufacturing } from "../checkoutPayload"
import type { SaleOrder, SaleOrderLine } from "../../../types"

// Paying an existing OV sent only `{ id }`: whatever the user set in the checkout's
// manufacturing step was silently dropped.

const line = (over: Partial<SaleOrderLine>): SaleOrderLine =>
    ({ description: "Volante", quantity: 1, uom: 1, unit_price: 10, tax_rate: 19, ...over })

describe("checkout payload of an existing order", () => {
    it("sends the manufacturing data of each line by its line id, without File objects", () => {
        const file = new File(["x"], "arte.pdf")
        const payload = existingOrderPayload({ id: 9, status: "DRAFT" } as SaleOrder, [
            line({ line_id: 31, manufacturing_data: { phases: { press: true }, design_files: [file] } }),
            line({ line_id: 32 }),
        ])

        expect(payload).toEqual({
            id: 9,
            line_edits: [
                { line_id: 31, manufacturing_data: { phases: { press: true }, design_filenames: ["arte.pdf"] } },
                { line_id: 32, manufacturing_data: null },
            ],
        })
    })

    it("sends no edits once the order is confirmed: the OT owns the configuration", () => {
        const order = { id: 9, status: "CONFIRMED" } as SaleOrder
        expect(existingOrderPayload(order, [line({ line_id: 31, manufacturing_data: {} })])).toEqual({ id: 9 })
        expect(canEditManufacturing(order)).toBe(false)
        expect(canEditManufacturing(null)).toBe(true)
    })
})
