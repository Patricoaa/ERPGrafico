import { describe, expect, it } from "vitest"
import { cardChargeLineEntity, chargeLine, installmentLine } from "../cardChargeLine.entity"
import type { PendingChargeRow, UpcomingInstallment } from "../../types"

describe("cardChargeLine (BillChargesModal)", () => {
    it("maps installments and charges to one line shape, with one entity per currency", () => {
        const inst = installmentLine({ id: 3, number: 2, total_installments: 6, due_date: "2026-12-10", principal_amount: "15000" } as UpcomingInstallment)
        expect(inst).toMatchObject({ key: "inst-3", number: "2/6", kind: "installment", typeLabel: "Cuota", amount: 15000 })
        const charge = chargeLine({ id: 9, amount: "990", charge_type_display: "Comisión", description: "", reference: "MANT" } as PendingChargeRow)
        expect(charge).toMatchObject({ key: "charge-9", number: "", reference: "MANT", amount: 990 })
        expect(cardChargeLineEntity("CLP")).toBe(cardChargeLineEntity("CLP"))
        expect(cardChargeLineEntity("USD")).not.toBe(cardChargeLineEntity("CLP"))
    })
})
