import { describe, expect, it, vi } from "vitest"
import type { Partner } from "@/features/contacts"
import { demoteBlockedReason, partnerActionsFor, partnerMenuActions } from "../partnerActions"

const base: Partner = {
    id: 7, name: "Ana Socia", tax_id: "1-9", partner_equity_percentage: "50",
    partner_total_contributions: "0", partner_total_paid_in: "0", partner_pending_capital: "0",
    partner_excess_capital: "0", partner_provisional_withdrawals_balance: "0",
    partner_earnings_balance: "0", partner_dividends_payable_balance: "0", partner_net_equity: "0",
}

const labels = (p: Partner, placement: "capital" | "results" | "menu", run = vi.fn()) =>
    partnerActionsFor(p, placement, { run }).map(a => ("label" in a ? a.label : undefined))

describe("partnerActionsFor", () => {
    it("capital incluye aporte y transferencia, y excluye retiro", () => {
        const l = labels(base, "capital")
        expect(l).toContain("Registrar aporte")
        expect(l).toContain("Transferir a otro socio")
        expect(l).not.toContain("Registrar retiro")
    })
    it("suscribir / reducir capital siempre está en Capital y abre la suscripción del socio", () => {
        const run = vi.fn()
        const a = partnerActionsFor(base, "capital", { run }).find(x => "label" in x && x.label === "Suscribir / reducir capital")
        if (!a || !("onClick" in a)) throw new Error("falta la acción")
        a.onClick({} as never)
        expect(run).toHaveBeenCalledWith({ type: "subscription", partnerId: 7 })
    })
    it("results incluye retiro", () => {
        expect(labels(base, "results")).toContain("Registrar retiro")
    })
    it("formalizar exceso solo con exceso > 0", () => {
        expect(labels(base, "capital")).not.toContain("Formalizar exceso de capital")
        expect(labels({ ...base, partner_excess_capital: "5" }, "capital")).toContain("Formalizar exceso de capital")
    })
    it("baja es del menú; bloqueada queda visible, deshabilitada y con el motivo", () => {
        expect(labels(base, "menu")).toEqual(["Dar de baja"])
        const blocked = { ...base, partner_total_contributions: "1" }
        const [a] = partnerActionsFor(blocked, "menu", { run: vi.fn() })
        if (!a || !("disabled" in a)) throw new Error("falta baja")
        expect(a.disabled).toBe(true)
        expect(a.disabledReason).toBe(demoteBlockedReason(blocked))
        const [ok] = partnerActionsFor(base, "menu", { run: vi.fn() })
        expect(ok && "disabled" in ok && ok.disabled).toBe(false)
    })
    it("transferir pide la acción con el socio de origen", () => {
        const run = vi.fn()
        const t = partnerActionsFor(base, "capital", { run }).find(a => "label" in a && a.label === "Transferir a otro socio")
        if (!t || !("onClick" in t)) throw new Error("falta transferir")
        t.onClick({} as never)
        expect(run).toHaveBeenCalledWith({ type: "transfer", fromPartnerId: 7 })
    })
})

describe("demoteBlockedReason", () => {
    it("sin cambios", () => {
        expect(demoteBlockedReason(base)).toBeNull()
        expect(demoteBlockedReason({ ...base, partner_total_contributions: "1" })).toMatch(/capital suscrito/)
    })
})

describe("partnerMenuActions", () => {
    it("agrupa capital, resultados y baja separados, sin separadores al borde", () => {
        const items = partnerMenuActions(base, { run: vi.fn() })
        const seps = items.flatMap((a, i) => ("separator" in a ? [i] : []))
        expect(seps).toHaveLength(2)
        expect(seps[0]).toBeGreaterThan(0)
        expect(seps[1]).toBeLessThan(items.length - 1)
    })
})
