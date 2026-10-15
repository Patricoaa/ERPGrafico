import { describe, it, expect } from "vitest"
import { documentForTask } from "../utils/taskDocument"
import type { Task } from "../api/workflowApi"

const task = (task_type: string, data: Record<string, unknown> = {}, object_id = 5) =>
    ({ task_type, data, object_id } as unknown as Task)

/** ADR-0083: cada tarea abre la ficha documental de su documento. */
describe("documentForTask", () => {
    it("maps order, invoice and work-order tasks", () => {
        expect(documentForTask(task("HUB_BILLING", { order_type: "sale" }))).toEqual({ label: "sales.saleorder", id: 5 })
        expect(documentForTask(task("HUB_TREASURY", { order_type: "purchase" }))).toEqual({ label: "purchasing.purchaseorder", id: 5 })
        expect(documentForTask(task("HUB_BILLING", { is_invoice: true, order_type: "sale" }))).toEqual({ label: "billing.invoice", id: 5 })
        expect(documentForTask(task("NC_FOLIO"))).toEqual({ label: "billing.invoice", id: 5 })
        expect(documentForTask(task("OC_APPROVAL"))).toEqual({ label: "purchasing.purchaseorder", id: 5 })
        expect(documentForTask(task("OT_STAGE"))).toEqual({ label: "production.workorder", id: 5 })
        expect(documentForTask(task("OT_CREATION", { sale_order_id: 9 }))).toEqual({ label: "sales.saleorder", id: 9 })
        expect(documentForTask(task("OT_CREATION"))).toEqual({ label: "production.workorder", id: 5 })
    })

    it("returns null for tasks without a document", () => {
        expect(documentForTask(task("CREDIT_POS_REQUEST"))).toBeNull()
        expect(documentForTask(task("HUB_ORIGIN", {}, 0))).toBeNull()
    })
})
