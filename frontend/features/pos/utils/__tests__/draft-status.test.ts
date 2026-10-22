import { describe, it, expect } from "vitest"
import { formatDraftNumber, resolveDraftStatuses, getPrimaryDraftStatus } from "../draft-status"
import type { SyncDraft } from "@/features/pos/hooks/useDraftSync"

function makeDraft(overrides: Partial<SyncDraft>): SyncDraft {
    const base: SyncDraft = {
        id: 42,
        session_local_id: 3,
        name: "Test Draft",
        customer_name: null,
        item_count: 0,
        total_gross: 0,
        is_locked: false,
        locked_by_name: null,
        locked_by_id: null,
        lock_session_key: "",
        locked_at: null,
        created_by_full_name: null,
        last_modified_by_full_name: null,
        wizard_state: {},
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
    }
    return { ...base, ...overrides }
}

describe("formatDraftNumber", () => {
    it("uses session_local_id when present", () => {
        expect(formatDraftNumber(makeDraft({ session_local_id: 1 }))).toBe("#1")
        expect(formatDraftNumber(makeDraft({ session_local_id: 5 }))).toBe("#5")
    })

    it("falls back to DB id when session_local_id is missing", () => {
        expect(formatDraftNumber(makeDraft({ session_local_id: undefined, id: 99 }))).toBe("#99")
    })

    it("falls back to DB id when session_local_id is 0 (legacy)", () => {
        expect(formatDraftNumber(makeDraft({ session_local_id: 0, id: 77 }))).toBe("#77")
    })
})

describe("resolveDraftStatuses priority", () => {
    it("locked by other > waiting payment > step > approval > approved", () => {
        const d = makeDraft({
            is_locked: true,
            locked_by_name: "Juan",
            wizard_state: { isWaitingPayment: true, step: 2, isWaitingApproval: true, isApproved: true },
        })
        const chips = resolveDraftStatuses(d)
        expect(chips.map(c => c.key)).toEqual(["locked", "waiting_payment", "step_2", "waiting_approval", "approved"])
    })

    it("waiting payment outranks step", () => {
        const d = makeDraft({
            wizard_state: { isWaitingPayment: true, step: 3 },
        })
        expect(resolveDraftStatuses(d).map(c => c.key)).toEqual(["waiting_payment", "step_3"])
    })

    it("step only when not waiting payment", () => {
        const d = makeDraft({
            wizard_state: { step: 2 },
        })
        expect(resolveDraftStatuses(d).map(c => c.key)).toEqual(["step_2"])
    })

    it("approval and approved only when not waiting payment", () => {
        const d = makeDraft({
            wizard_state: { isWaitingApproval: true, isApproved: true },
        })
        expect(resolveDraftStatuses(d).map(c => c.key)).toEqual(["waiting_approval", "approved"])
    })

    it("no status when clean draft", () => {
        const d = makeDraft({})
        expect(resolveDraftStatuses(d)).toEqual([])
    })
})

describe("getPrimaryDraftStatus (compact top strip)", () => {
    it("returns locked chip when locked by other", () => {
        const d = makeDraft({ is_locked: true, locked_by_name: "Ana" })
        expect(getPrimaryDraftStatus(d)?.key).toBe("locked")
    })

    it("returns waiting_payment when not locked", () => {
        const d = makeDraft({ wizard_state: { isWaitingPayment: true } })
        expect(getPrimaryDraftStatus(d)?.key).toBe("waiting_payment")
    })

    it("returns step when no payment waiting", () => {
        const d = makeDraft({ wizard_state: { step: 1 } })
        expect(getPrimaryDraftStatus(d)?.key).toBe("step_1")
    })

    it("returns null for clean draft", () => {
        const d = makeDraft({})
        expect(getPrimaryDraftStatus(d)).toBeNull()
    })
})