import { describe, expect, it } from "vitest"
import { toOutsourcedPurchaseLines } from "../outsourcedPurchase.entity"
import type { WorkOrderMaterial } from "../../types"

describe("toOutsourcedPurchaseLines (WorkOrderWizard)", () => {
    it("computes gross unit and total prices at the VAT rate, rounded to pesos", () => {
        const [line] = toOutsourcedPurchaseLines([
            { id: 4, supplier_name: "Laminados Sur", component_name: "Laminado mate", quantity_planned: 3, unit_price: "1000" } as unknown as WorkOrderMaterial,
        ], 1.19)
        expect(line).toMatchObject({ supplier: "Laminados Sur", service: "Laminado mate", quantity: 3, unitGross: 1190, totalGross: 3570 })
    })
})
