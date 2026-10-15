import { describe, it, expect } from "vitest"
import { Banknote } from "lucide-react"
import { resolveRegistryActions } from "@/features/documents"
import type { ActionRegistry } from "@/types/actions"
import { planOrderSheetActions, SHEET_EXCLUDED_ACTIONS } from "../utils/orderSheetActions"
import { getOrderLifecycle } from "../utils/lifecycle"
import type { Order } from "../types"

type Doc = { status: string; pending_amount?: number }

const registry: ActionRegistry<Doc> = {
    payments: {
        id: "payments", label: "Pagos", icon: Banknote, actions: [
            { id: "register-payment", label: "Registrar pago", icon: Banknote, requiredPermissions: ["treasury.add_payment"], checkAvailability: (d) => (d.pending_amount ?? 0) > 0 },
            { id: "payment-history", label: "Historial", icon: Banknote },
        ],
    },
    deliveries: {
        id: "deliveries", label: "Despachos", icon: Banknote, actions: [
            { id: "register-delivery", label: "Despachar", icon: Banknote, excludedStatus: ["CANCELLED"] },
            { id: "register-merchandise-return", label: "Devolución", icon: Banknote },
        ],
    },
    returns: {
        id: "returns", label: "Devoluciones", icon: Banknote, actions: [
            { id: "register-merchandise-return", label: "Devolución", icon: Banknote },
        ],
    },
    notes: {
        id: "notes", label: "Notas", icon: Banknote, actions: [
            { id: "create-credit-note", label: "NC", icon: Banknote, isDisabled: () => true, disabledTooltip: "Falta folio" },
        ],
    },
}

/** ADR-0083: acciones de la ficha documental (mismas reglas que PhaseCard del Hub). */
describe("resolveRegistryActions", () => {
    it("applies permissions (any of), excluded status, availability and dedupes ids", () => {
        const resolved = resolveRegistryActions(registry, { status: "CONFIRMED", pending_amount: 10 }, ["treasury.add_payment"], (id) => SHEET_EXCLUDED_ACTIONS.has(id))
        expect(resolved.map((r) => r.action.id)).toEqual(["register-payment", "register-delivery", "register-merchandise-return", "create-credit-note"])
        expect(resolved.find((r) => r.action.id === "create-credit-note")).toMatchObject({ disabled: true, disabledReason: "Falta folio" })
    })

    it("hides actions without permission, unavailable or for excluded status", () => {
        const ids = resolveRegistryActions(registry, { status: "CANCELLED", pending_amount: 0 }, [], (id) => SHEET_EXCLUDED_ACTIONS.has(id)).map((r) => r.action.id)
        expect(ids).not.toContain("register-payment")
        expect(ids).not.toContain("register-delivery")
    })
})

describe("planOrderSheetActions", () => {
    it("picks the next cycle step as primary and maps categories to areas", () => {
        const plan = planOrderSheetActions(resolveRegistryActions(registry, { status: "CONFIRMED", pending_amount: 10 }, ["treasury.add_payment"]))
        expect(plan.primary?.action.id).toBe("register-delivery")
        expect(plan.secondary.map((r) => r.action.id)).toEqual(["register-payment"])
        expect(plan.overflow.map((r) => r.action.id)).toEqual(["payment-history", "register-merchandise-return", "create-credit-note"])
        expect(plan.byDomain.treasury?.map((r) => r.action.id)).toEqual(["register-payment", "payment-history"])
        expect(plan.byDomain.logistics?.map((r) => r.action.id)).toEqual(["register-delivery", "register-merchandise-return"])
        expect(plan.byDomain.billing?.map((r) => r.action.id)).toEqual(["create-credit-note"])
    })

    it("never makes a disabled action primary", () => {
        const plan = planOrderSheetActions(resolveRegistryActions(registry, { status: "CONFIRMED" }, []))
        expect(plan.primary?.action.id).toBe("register-delivery")
        expect(plan.overflow.some((r) => r.action.id === "create-credit-note")).toBe(true)
    })
})

describe("getOrderLifecycle", () => {
    const order = (overrides: Partial<Order>): Order => ({
        id: 1, number: "1", status: "CONFIRMED", total: 1000, pending_amount: 400,
        lines: [
            { id: 1, quantity: 4, quantity_delivered: 2, quantity_invoiced: 4, price_unit: 100, subtotal: 400 },
            { id: 2, quantity: 6, quantity_delivered: 2, quantity_invoiced: 0, price_unit: 100, subtotal: 600 },
        ],
        ...overrides,
    })

    it("uses invoicing_status (ADR-0081) and quantity progress", () => {
        const { steps, figures } = getOrderLifecycle(order({ invoicing_status: "PARTIAL" }), "sale")
        const byId = Object.fromEntries(steps.map((s) => [s.id, s]))
        expect(byId.billing).toMatchObject({ status: "active", progress: 40 })
        expect(byId.logistics).toMatchObject({ status: "active", progress: 40 })
        expect(byId.treasury).toMatchObject({ status: "active", progress: 60 })
        expect(byId.production.status).toBe("not_applicable")
        expect(figures.map((f) => f.label)).toEqual(["Total", "Pagado", "Saldo", "Entregado"])
    })

    it("marks the cycle as not applicable for a cancelled order", () => {
        const { steps } = getOrderLifecycle(order({ status: "CANCELLED" }), "purchase")
        expect(steps.filter((s) => s.status !== "not_applicable").map((s) => s.id)).toEqual(["origin"])
        expect(steps[0].status).toBe("destructive")
    })
})
