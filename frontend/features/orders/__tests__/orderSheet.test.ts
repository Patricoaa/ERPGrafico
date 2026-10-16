import { describe, it, expect } from "vitest"
import { Banknote } from "lucide-react"
import { resolveRegistryActions } from "@/features/documents"
import type { ActionRegistry } from "@/types/actions"
import { planOrderSheetActions, SHEET_EXCLUDED_ACTIONS } from "../utils/orderSheetActions"
import { getInvoiceLifecycle, getOrderLifecycle } from "../utils/lifecycle"
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
        const steps = getOrderLifecycle(order({
            invoicing_status: "PARTIAL",
            invoices: [{ id: 1, status: "POSTED", number: "9101" }],
        }), "sale")
        const byId = Object.fromEntries(steps.map((s) => [s.id, s]))
        expect(byId.billing).toMatchObject({ status: "active", progress: 40 })
        expect(byId.logistics).toMatchObject({ status: "active", progress: 40 })
        expect(byId.treasury).toMatchObject({ status: "active", progress: 60 })
        expect(byId.production.status).toBe("not_applicable")
        expect(steps.map((s) => s.label)).toEqual(["Origen", "Facturación", "Manufactura", "Logística", "Tesorería"])
    })

    it("marks the cycle as not applicable for a cancelled order", () => {
        const steps = getOrderLifecycle(order({ status: "CANCELLED" }), "purchase")
        expect(steps.filter((s) => s.status !== "not_applicable").map((s) => s.id)).toEqual(["origin"])
        expect(steps[0].status).toBe("destructive")
    })
})

describe("orderLineFields", () => {
    it("keeps the owner-defined column order with Subtotal last", async () => {
        const { orderLineFields } = await import("../orderLineFields")
        const ids = orderLineFields.toColumns().map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey)
        expect(ids).toEqual(["product_name", "quantity", "unit_price", "quantity_delivered", "quantity_invoiced", "work_order_summary", "subtotal_net"])
    })
})

describe("ciclo: fuente única tarjeta/ficha", () => {
    it("a draft invoice (no folio) leaves billing empty; issued invoices drive progress", async () => {
        const { billingStage, getHubStatuses } = await import("@/lib/workflow-status")
        const order = {
            status: "INVOICED", invoicing_status: "INVOICED", total: 50000, pending_amount: 0,
            invoices: [{ status: "PAID", number: "" }],
            lines: [{ quantity: 10, quantity_delivered: 10, quantity_invoiced: 10 }],
        }
        expect(billingStage(order)).toEqual({ billingStatus: "neutral", billingFolioPending: true })
        expect(getHubStatuses(order).billing).toBe("neutral")
        const withFolio = { ...order, invoices: [{ status: "POSTED", number: "9101" }] }
        expect(billingStage(withFolio).billingStatus).toBe("success")
        expect(billingStage({ ...withFolio, invoicing_status: "PARTIAL" }).billingStatus).toBe("active")
        const mixed = { ...order, invoices: [{ status: "POSTED", number: "9101" }, { status: "POSTED", number: "" }] }
        expect(billingStage(mixed)).toEqual({ billingStatus: "active", billingFolioPending: true })
        expect(billingStage({ status: "CONFIRMED", invoicing_status: "PENDING" }).billingStatus).toBe("neutral")
    })

    it("sheet lifecycle shows the same billing state with 'Folio pendiente'", () => {
        const order = {
            id: 4, number: "000004", status: "INVOICED", invoicing_status: "INVOICED", total: 50000, pending_amount: 0,
            invoices: [{ id: 13, status: "PAID", number: "" }],
            lines: [{ id: 1, quantity: 10, quantity_delivered: 10, quantity_invoiced: 10, price_unit: 0, subtotal: 50000 }],
        } as unknown as Order
        const billing = getOrderLifecycle(order, "sale").find((s) => s.id === "billing")
        expect(billing).toMatchObject({ status: "neutral", detail: "Folio pendiente" })
    })

    it("maps stage statuses to badge intents (in progress is not green)", async () => {
        const { stageIntent } = await import("@/lib/workflow-status")
        expect(stageIntent("active")).toBe("warning")
        expect(stageIntent("success")).toBe("success")
        expect(stageIntent("neutral")).toBe("neutral")
        expect(stageIntent(undefined)).toBe("neutral")
    })
})


describe("getInvoiceLifecycle (U3)", () => {
    const invoice = (overrides: Partial<Order>): Order => ({
        id: 13, number: "", status: "DRAFT", dte_type: "FACTURA", total: 50000, pending_amount: 0,
        payment_status: "PAID", order_delivery_status: "DELIVERED", lines: [], ...overrides,
    } as unknown as Order)

    it("draft (folio pending) leaves Emisión empty even when paid (ADR-0084)", () => {
        const byId = Object.fromEntries(getInvoiceLifecycle(invoice({})).map((s) => [s.id, s]))
        expect(byId.billing).toMatchObject({ label: "Emisión", status: "neutral", detail: "Folio pendiente" })
        expect(byId.treasury).toMatchObject({ status: "success", detail: "100% pagado" })
    })

    it("issued invoice shows its folio; partial payment is in progress", () => {
        const byId = Object.fromEntries(getInvoiceLifecycle(invoice({
            status: "POSTED", number: "9101", pending_amount: 20000, payment_status: "PARTIAL",
        })).map((s) => [s.id, s]))
        expect(byId.billing).toMatchObject({ status: "success", detail: "Folio 9101" })
        expect(byId.treasury).toMatchObject({ status: "active", detail: "60% pagado" })
    })

    it("cancelled invoice: emission destructive, rest not applicable", () => {
        const steps = getInvoiceLifecycle(invoice({ status: "CANCELLED" }))
        expect(steps.filter((s) => s.status !== "not_applicable").map((s) => s.id)).toEqual(["origin", "billing"])
    })
})

describe("invoiceLineFields", () => {
    it("product · quantity · unit price · subtotal last", async () => {
        const { invoiceLineFields } = await import("../invoiceLineFields")
        const ids = invoiceLineFields.toColumns().map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey)
        expect(ids).toEqual(["product_name", "quantity", "unit_price", "subtotal_net"])
    })
})
