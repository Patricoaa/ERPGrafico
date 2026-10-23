import { describe, expect, it } from "vitest"

import {
    deriveStageEvidence,
    stageGroup,
    stageSummary,
    TASK_TYPE_TO_STAGE,
} from "../stageEvidence"
import type { WorkOrder } from "../../types"

function makeOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
    return {
        id: 1,
        display_id: "OT-001",
        main_product_id: 10,
        product_name: "Flyer A5",
        status: "IN_PROGRESS",
        current_stage: "PRESS",
        requires_prepress: true,
        requires_press: true,
        requires_postpress: false,
        is_manual: false,
        ...overrides,
    }
}

describe("deriveStageEvidence", () => {
    it("keeps the latest stage_history entry per stage", () => {
        const order = makeOrder({
            stage_history: [
                { id: 3, stage: "PRESS", status: "IN_PROGRESS", created_at: "2026-10-20T10:00:00Z", user_name: "Ana" },
                { id: 2, stage: "PRESS", status: "IN_PROGRESS", created_at: "2026-10-18T10:00:00Z", user_name: "Luis" },
                { id: 1, stage: "PREPRESS", status: "IN_PROGRESS", created_at: "2026-10-17T10:00:00Z", user_name: "Ana" },
            ],
        })

        const evidence = deriveStageEvidence(order)

        expect(evidence.PRESS.enteredAt).toBe("2026-10-20T10:00:00Z")
        expect(evidence.PRESS.enteredBy).toBe("Ana")
        expect(evidence.PREPRESS.enteredBy).toBe("Ana")
    })

    it("maps approval tasks to their stage and builds blocker warnings", () => {
        const order = makeOrder({
            workflow_tasks: [
                { id: 1, task_type: "OT_MATERIAL_APPROVAL", status: "PENDING" },
                { id: 2, task_type: "OT_MATERIAL_APPROVAL", status: "IN_PROGRESS" },
                { id: 3, task_type: "OT_MATERIAL_APPROVAL", status: "COMPLETED" },
                { id: 4, task_type: "OT_PRESS_APPROVAL", status: "PENDING" },
                { id: 5, task_type: "OT_CREATION", status: "PENDING" },
            ],
        })

        const evidence = deriveStageEvidence(order)

        expect(evidence.MATERIAL_APPROVAL.pendingTasks).toBe(2)
        expect(evidence.MATERIAL_APPROVAL.completedTasks).toBe(1)
        expect(evidence.MATERIAL_APPROVAL.warning).toBe("2 aprobaciones pendientes")
        expect(evidence.PRESS.warning).toBe("1 tarea pendiente")
        expect(evidence.ORIGIN_SELECTION).toBeUndefined()
    })

    it("counts manual stock and outsourced services", () => {
        const order = makeOrder({
            materials: [
                {
                    id: 1, component: 1, component_name: "Papel", quantity_planned: 100,
                    uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false,
                    is_available: true,
                },
                {
                    id: 2, component: 2, component_name: "Tinta", quantity_planned: 5,
                    uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false,
                    is_available: false,
                },
                {
                    id: 3, component: 3, component_name: "Encuadernado", quantity_planned: 10,
                    uom: 1, uom_name: "u", total_cost: 0, source: "MANUAL", is_outsourced: true,
                },
            ],
        })

        const evidence = deriveStageEvidence(order)

        expect(evidence.MATERIAL_ASSIGNMENT.materialsTotal).toBe(2)
        expect(evidence.MATERIAL_ASSIGNMENT.materialsAvailable).toBe(1)
        expect(evidence.MATERIAL_ASSIGNMENT.materialsMissing).toBe(1)
        expect(evidence.MATERIAL_ASSIGNMENT.warning).toBe("1 material sin stock")
        expect(evidence.OUTSOURCING_ASSIGNMENT.outsourcedTotal).toBe(1)
    })

    it("returns an empty map without an order", () => {
        expect(deriveStageEvidence(null)).toEqual({})
    })
})

describe("stageGroup", () => {
    it("chunks stages into preparation, production and closing", () => {
        expect(stageGroup("ORIGIN_SELECTION")).toBe("Preparación")
        expect(stageGroup("MATERIAL_ASSIGNMENT")).toBe("Preparación")
        expect(stageGroup("PREPRESS")).toBe("Producción")
        expect(stageGroup("POSTPRESS")).toBe("Producción")
        expect(stageGroup("RECTIFICATION")).toBe("Cierre")
        expect(stageGroup("FINISHED")).toBe("Cierre")
    })
})

describe("stageSummary", () => {
    it("describes the order origin", () => {
        expect(stageSummary("ORIGIN_SELECTION", undefined, makeOrder({ sale_order: { id: 7, number: "123" } })))
            .toBe("Vinculada a OV #123")
        expect(stageSummary("ORIGIN_SELECTION", undefined, makeOrder({ is_manual: true })))
            .toBe("Fabricación manual")
        expect(stageSummary("ORIGIN_SELECTION", undefined, makeOrder()))
            .toBe("Fabricación para stock")
    })

    it("summarizes materials with availability and shortages", () => {
        const order = makeOrder({
            materials: [
                { id: 1, component: 1, component_name: "Papel", quantity_planned: 10, uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false, is_available: true },
                { id: 2, component: 2, component_name: "Tinta", quantity_planned: 10, uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false, is_available: false },
            ],
        })

        expect(stageSummary("MATERIAL_ASSIGNMENT", deriveStageEvidence(order).MATERIAL_ASSIGNMENT, order))
            .toBe("1/2 disponibles · 1 faltante")
    })

    it("falls back to stage history for production stages", () => {
        const order = makeOrder({
            stage_history: [
                { id: 1, stage: "PRESS", status: "IN_PROGRESS", created_at: "2026-10-20T10:00:00Z", user_name: "Ana" },
            ],
        })

        expect(stageSummary("PRESS", deriveStageEvidence(order).PRESS, order, true))
            .toBe("Desde 20/10/2026 · Ana")
    })

    it("describes rectification quantities", () => {
        const order = makeOrder({ quantity: 500, actual_quantity_produced: 480 })
        expect(stageSummary("RECTIFICATION", undefined, order)).toBe("480/500 producidas")
    })
})

describe("TASK_TYPE_TO_STAGE", () => {
    it("covers every approval task type used by the workflow", () => {
        expect(Object.keys(TASK_TYPE_TO_STAGE)).toHaveLength(6)
    })
})
