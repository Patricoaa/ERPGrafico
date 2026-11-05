import { describe, expect, it } from "vitest"
import { formatMovementPath, movementEndpoints } from "../movementPath"
import type { TreasuryMovement } from "../../types"

function movement(patch: Partial<TreasuryMovement>): TreasuryMovement {
    return {
        id: 1,
        display_id: "MOV-1",
        movement_type: "OUTBOUND",
        movement_type_display: "Retiro",
        payment_method: "TRANSFER",
        payment_method_display: "Transferencia",
        amount: 1000,
        created_at: "2026-11-01T10:00:00Z",
        date: "2026-11-01",
        created_by: null,
        created_by_name: "test",
        notes: "",
        pos_session: null,
        from_account: null,
        from_account_name: null,
        from_account_account_id: null,
        from_account_code: null,
        to_account: null,
        to_account_name: null,
        to_account_account_id: null,
        to_account_code: null,
        justify_reason: null,
        justify_reason_display: null,
        partner_name: null,
        partner_id: null,
        reference: null,
        ...patch,
    }
}

const ACCOUNT = { id: 7, name: "Caja Principal" }
const PARTNER = { id: 42, name: "Proveedor Uno" }

describe("movementEndpoints", () => {
    it("outbound: treasury account → linked contact", () => {
        const path = movementEndpoints(movement({
            movement_type: "OUTBOUND",
            from_account: ACCOUNT.id,
            from_account_name: ACCOUNT.name,
            partner_id: PARTNER.id,
            partner_name: PARTNER.name,
        }))

        expect(path.from).toEqual({ kind: "treasury", ...ACCOUNT })
        expect(path.to).toEqual({ kind: "contact", ...PARTNER })
    })

    it("inbound: linked contact → treasury account", () => {
        const path = movementEndpoints(movement({
            movement_type: "INBOUND",
            to_account: ACCOUNT.id,
            to_account_name: ACCOUNT.name,
            partner_id: PARTNER.id,
            partner_name: PARTNER.name,
        }))

        expect(path.from).toEqual({ kind: "contact", ...PARTNER })
        expect(path.to).toEqual({ kind: "treasury", ...ACCOUNT })
    })

    it("outbound without a counterparty falls back to Particular (not a link)", () => {
        const path = movementEndpoints(movement({
            movement_type: "OUTBOUND",
            from_account: ACCOUNT.id,
            from_account_name: ACCOUNT.name,
            partner_name: "Particular",
        }))

        expect(path.to).toEqual({ kind: "text", name: "Particular" })
    })

    it("transfer links both treasury accounts", () => {
        const path = movementEndpoints(movement({
            movement_type: "TRANSFER",
            from_account: ACCOUNT.id,
            from_account_name: ACCOUNT.name,
            to_account: 9,
            to_account_name: "Banco",
        }))

        expect(path.from).toEqual({ kind: "treasury", ...ACCOUNT })
        expect(path.to).toEqual({ kind: "treasury", id: 9, name: "Banco" })
    })

    it("never links an account that has no id", () => {
        const path = movementEndpoints(movement({
            movement_type: "OUTBOUND",
            from_account_name: "Cuenta antigua",
            partner_name: "Particular",
        }))

        expect(path.from).toEqual({ kind: "text", name: "Cuenta" })
    })

    it("formats the path as plain text for cards, export and print", () => {
        const path = movementEndpoints(movement({
            movement_type: "OUTBOUND",
            from_account: ACCOUNT.id,
            from_account_name: ACCOUNT.name,
            partner_id: PARTNER.id,
            partner_name: PARTNER.name,
        }))

        expect(formatMovementPath(path)).toBe("Caja Principal → Proveedor Uno")
    })
})
