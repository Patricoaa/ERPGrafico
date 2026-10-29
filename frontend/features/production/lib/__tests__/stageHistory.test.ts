import { describe, it, expect } from "vitest"
import { buildHistory } from "../stageHistory"
import type { WorkOrderHistoryEntry, WorkOrderTask } from "../../types"

function makeEntry(overrides: Partial<WorkOrderHistoryEntry> = {}): WorkOrderHistoryEntry {
    return {
        id: 1,
        stage: "PREPRESS",
        status: "IN_PROGRESS",
        notes: "test note",
        user: null,
        user_name: null,
        created_at: "2024-01-01T10:00:00Z",
        work_order: 1,
        ...overrides,
    }
}

describe("buildHistory — stage entries kind mapping", () => {
    it("maps event=REOPENED to kind=reopened", () => {
        const entry = makeEntry({ event: "REOPENED", stage: "PREPRESS" })
        const items = buildHistory([], [entry])
        expect(items[0].kind).toBe("reopened")
    })

    it("maps event=ENTERED to kind=entered", () => {
        const entry = makeEntry({ event: "ENTERED", stage: "PRESS" })
        const items = buildHistory([], [entry])
        expect(items[0].kind).toBe("entered")
    })

    it("maps event=EDITED to kind=edited", () => {
        const entry = makeEntry({ event: "EDITED", stage: "MATERIAL_ASSIGNMENT" })
        const items = buildHistory([], [entry])
        expect(items[0].kind).toBe("edited")
    })

    it("maps event=NOTE to kind=note", () => {
        const entry = makeEntry({ event: "NOTE", stage: "PRESS" })
        const items = buildHistory([], [entry])
        expect(items[0].kind).toBe("note")
    })

    it("falls back to entered when event is missing", () => {
        // Backend returns status=DRAFT or status=IN_PROGRESS (WorkOrder.Status)
        // which is NOT a valid event key — should still default gracefully
        const entry = makeEntry({ event: undefined, stage: "PRESS" })
        const items = buildHistory([], [entry])
        expect(items[0].kind).toBe("entered")
    })
})
