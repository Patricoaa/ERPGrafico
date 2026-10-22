import { describe, it, expect } from "vitest"
import {
    formatDraftNumber,
    resolveDraftPhase,
    resolveDraftStatus,
    resolveDraftStatusChips,
    statusToneBg,
    statusToneText,
} from "../draft-status"
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

describe("resolveDraftPhase", () => {
    it("uses phaseId when present", () => {
        const d = makeDraft({ wizard_state: { phaseId: "manufacturing" } })
        const phase = resolveDraftPhase(d)
        expect(phase?.id).toBe("manufacturing")
        expect(phase?.label).toBe("Fabricación")
    })

    it("falls back to step heuristic for legacy drafts", () => {
        const d1 = makeDraft({ wizard_state: { step: 1 } })
        expect(resolveDraftPhase(d1)?.id).toBe("customer")

        const d2 = makeDraft({ wizard_state: { step: 2 } })
        expect(resolveDraftPhase(d2)?.id).toBe("dte")

        const d3 = makeDraft({ wizard_state: { step: 3 } })
        expect(resolveDraftPhase(d3)?.id).toBe("delivery")

        const d4 = makeDraft({ wizard_state: { step: 4 } })
        expect(resolveDraftPhase(d4)?.id).toBe("payment")
    })

    it("returns null when no phase info", () => {
        const d = makeDraft({})
        expect(resolveDraftPhase(d)).toBeNull()
    })
})

describe("resolveDraftStatus priority", () => {
    it("locked by other > approval > approved > payment waiting > phase > none", () => {
        // Locked by other wins
        const d1 = makeDraft({
            is_locked: true,
            locked_by_name: "Juan",
            wizard_state: { isWaitingApproval: true, isApproved: true, isWaitingPayment: true, phaseId: "payment" },
        })
        expect(resolveDraftStatus(d1)?.label).toBe("En uso por Juan")

        // Waiting approval wins over approved
        const d2 = makeDraft({
            wizard_state: { isWaitingApproval: true, isApproved: true },
        })
        expect(resolveDraftStatus(d2)?.icon).toBeDefined() // ShieldAlert

        // Approved wins over payment waiting
        const d3 = makeDraft({
            wizard_state: { isApproved: true, isWaitingPayment: true, phaseId: "payment" },
        })
        expect(resolveDraftStatus(d3)?.label).toBe("Aprobado")

        // Payment waiting wins over phase
        const d4 = makeDraft({
            wizard_state: { isWaitingPayment: true, phaseId: "payment" },
        })
        expect(resolveDraftStatus(d4)?.label).toBe("Pendiente de pago")

        // Phase shown when no higher priority
        const d5 = makeDraft({
            wizard_state: { phaseId: "delivery" },
        })
        expect(resolveDraftStatus(d5)?.label).toBe("Fase: Entrega")

        // None when clean
        const d6 = makeDraft({})
        expect(resolveDraftStatus(d6)).toBeNull()
    })

    it("own lock does not show in top strip (opts.isOwnLock=true)", () => {
        const d = makeDraft({
            is_locked: true,
            locked_by_name: "Yo",
            lock_session_key: "my-session",
        })
        const status = resolveDraftStatus(d, { isOwnLock: true })
        expect(status).toBeNull()
    })

    it("locked by other shows even with ownLock=false", () => {
        const d = makeDraft({
            is_locked: true,
            locked_by_name: "Otro",
            lock_session_key: "other-session",
        })
        const status = resolveDraftStatus(d, { isOwnLock: false })
        expect(status?.label).toBe("En uso por Otro")
        expect(status?.tone).toBe("destructive")
    })
})

describe("resolveDraftStatusChips (full list)", () => {
    it("includes own lock chip", () => {
        const d = makeDraft({ is_locked: true, locked_by_name: "Yo" })
        const chips = resolveDraftStatusChips(d, { isOwnLock: true })
        expect(chips.find(c => c.key === "own_lock")?.label).toBe("Tú")
    })

    it("includes locked by other chip", () => {
        const d = makeDraft({ is_locked: true, locked_by_name: "Otro" })
        const chips = resolveDraftStatusChips(d, { isOwnLock: false })
        expect(chips.find(c => c.key === "locked")?.label).toBe("En uso por Otro")
    })

    it("waiting approval chip", () => {
        const d = makeDraft({ wizard_state: { isWaitingApproval: true } })
        const chips = resolveDraftStatusChips(d)
        expect(chips.find(c => c.key === "waiting_approval")?.label).toBe("Esperando aprobación")
    })

    it("approved chip", () => {
        const d = makeDraft({ wizard_state: { isApproved: true } })
        const chips = resolveDraftStatusChips(d)
        expect(chips.find(c => c.key === "approved")?.label).toBe("Aprobado")
    })

    it("payment waiting replaces phase chip when in payment phase", () => {
        const d = makeDraft({
            wizard_state: { isWaitingPayment: true, phaseId: "payment" },
        })
        const chips = resolveDraftStatusChips(d)
        expect(chips.find(c => c.key === "waiting_payment")).toBeDefined()
        expect(chips.find(c => c.key === "phase_payment")).toBeUndefined()
    })

    it("phase chip shown when not in payment or not waiting payment", () => {
        const d = makeDraft({ wizard_state: { phaseId: "delivery" } })
        const chips = resolveDraftStatusChips(d)
        expect(chips.find(c => c.key === "phase_delivery")?.label).toBe("Entrega")
    })

    it("priority order: locked > own > waiting_approval > approved > waiting_payment > phase", () => {
        const d = makeDraft({
            is_locked: true,
            locked_by_name: "Juan",
            wizard_state: {
                isWaitingApproval: true,
                isApproved: true,
                isWaitingPayment: true,
                phaseId: "payment",
            },
        })
        const chips = resolveDraftStatusChips(d, { isOwnLock: false })
        const keys = chips.map(c => c.key)
        expect(keys.indexOf("locked")).toBeLessThan(keys.indexOf("waiting_approval"))
        expect(keys.indexOf("waiting_approval")).toBeLessThan(keys.indexOf("approved"))
        expect(keys.indexOf("approved")).toBeLessThan(keys.indexOf("waiting_payment"))
    })
})

describe("status tone colors", () => {
    it("destructive -> bg-destructive/10", () => {
        expect(statusToneBg("destructive")).toBe("bg-destructive/10")
    })
    it("warning -> bg-warning/10", () => {
        expect(statusToneBg("warning")).toBe("bg-warning/10")
    })
    it("success -> bg-success/10", () => {
        expect(statusToneBg("success")).toBe("bg-success/10")
    })
    it("primary -> bg-primary/10", () => {
        expect(statusToneBg("primary")).toBe("bg-primary/10")
    })
    it("muted -> bg-muted/40", () => {
        expect(statusToneBg("muted")).toBe("bg-muted/40")
    })

    it("text colors map correctly", () => {
        expect(statusToneText("destructive")).toBe("text-destructive")
        expect(statusToneText("warning")).toBe("text-warning")
        expect(statusToneText("success")).toBe("text-success")
        expect(statusToneText("primary")).toBe("text-primary")
        expect(statusToneText("muted")).toBe("text-muted-foreground")
    })
})