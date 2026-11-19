import { describe, it, expect } from "vitest"
import { resolveRegistryActions } from "@/features/documents"
import { saleOrderActions } from "../actions"

const PERMS = ["billing.add_invoice"]
const noteState = (invoices: Record<string, unknown>[], status = "CONFIRMED") => {
    const r = resolveRegistryActions(saleOrderActions, { status, invoices } as never, PERMS)
        .find((x) => x.action.id === "create-credit-note")
    return r ? { visible: true, disabled: r.disabled } : { visible: false, disabled: false }
}

describe("sale order credit/debit note availability", () => {
    it("is hidden without a correctable DTE", () => {
        expect(noteState([]).visible).toBe(false)
        expect(noteState([{ dte_type: "NOTA_CREDITO", status: "POSTED" }]).visible).toBe(false)
    })

    it("is hidden for cancelled orders", () => {
        expect(noteState([{ dte_type: "FACTURA", status: "POSTED" }], "CANCELLED").visible).toBe(false)
    })

    it("is disabled while the document is a draft", () => {
        expect(noteState([{ dte_type: "FACTURA", status: "DRAFT" }])).toEqual({ visible: true, disabled: true })
    })

    it("is enabled for a posted COMPROBANTE_PAGO (48) without folio", () => {
        expect(noteState([{ dte_type: "COMPROBANTE_PAGO", status: "POSTED", number: "" }])).toEqual({ visible: true, disabled: false })
    })

    it("a posted note alone does not enable it", () => {
        expect(noteState([{ dte_type: "FACTURA", status: "DRAFT" }, { dte_type: "NOTA_CREDITO", status: "POSTED", number: "9" }]).disabled).toBe(true)
    })
})
