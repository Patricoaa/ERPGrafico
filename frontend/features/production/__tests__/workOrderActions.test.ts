import { describe, it, expect, vi } from "vitest"
import { workOrderActionItems } from "../workOrderActions"
import type { WorkOrder } from "../types"

// deletion-policy: a WorkOrder is annulled, never hard-deleted. A draft OT could only be
// "deleted" (annul was hidden for DRAFT), so the row offered the forbidden action.

const ctx = { onEdit: vi.fn(), onDuplicate: vi.fn(), onAnnul: vi.fn() }
const order = (over: Partial<WorkOrder>) =>
    ({ id: 1, status: "DRAFT", current_stage: "MATERIAL_ASSIGNMENT", is_cancellable: true, ...over }) as WorkOrder
const visible = (o: WorkOrder): string[] =>
    workOrderActionItems(o, ctx).flatMap((a) => ("action" in a && a.visible !== false ? [a.action] : []))

describe("workOrderActions", () => {
    it("never offers a hard delete", () => {
        expect(visible(order({}))).not.toContain("delete")
    })

    it("lets a draft OT be annulled", () => {
        expect(visible(order({}))).toContain("annul")
    })

    it("follows the server on whether the OT can still be annulled", () => {
        expect(visible(order({ status: "IN_PROGRESS", current_stage: "RECTIFICATION", is_cancellable: false }))).not.toContain("annul")
        expect(visible(order({ status: "FINISHED", current_stage: "FINISHED" }))).not.toContain("annul")
    })

    it("hides annul when consumptions already exist", () => {
        expect(visible(order({ has_consumptions: true }))).not.toContain("annul")
    })
})
