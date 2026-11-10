import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useDrafts } from "../useDrafts"

const ensureOperator = vi.fn<(purpose: string, target?: { type: string; id: number }) => Promise<boolean>>()
const bindTarget = vi.fn()
const release = vi.fn()
const createDraft = vi.fn()
const updateDraft = vi.fn()
const getDraft = vi.fn()
const getDrafts = vi.fn()

const setCurrentDraftId = vi.fn()
let currentDraftId: number | null = null

vi.mock("../../operator", () => ({
    useOperatorGate: () => ({
        ensureOperator: (...a: [string, { type: string; id: number }?]) => ensureOperator(...a),
        bindTarget: (id: number) => bindTarget(id),
        release: (p?: string) => release(p),
    }),
}))
vi.mock("../../contexts/POSProvider", () => ({
    usePOS: () => ({
        items: [{ id: 1, qty: 1, uom: 1, unit_price_net: 100, unit_price_gross: 119, cartItemId: "c1" }],
        setItems: vi.fn(),
        selectedCustomerId: null,
        setSelectedCustomerId: vi.fn(),
        currentSession: { id: 5, mode: "MULTI" },
        currentDraftId,
        setCurrentDraftId,
        wizardState: null,
        setWizardState: vi.fn(),
    }),
}))
vi.mock("@/features/realtime", () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))
vi.mock("../../api/posApi", () => ({
    posApi: {
        createDraft: (...a: unknown[]): unknown => createDraft(...a),
        updateDraft: (...a: unknown[]): unknown => updateDraft(...a),
        getDraft: (...a: unknown[]): unknown => getDraft(...a),
        getDrafts: (...a: unknown[]): unknown => getDrafts(...a),
        getProduct: vi.fn(),
    },
}))

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useDrafts + operador de caja", () => {
    beforeEach(() => {
        for (const m of [ensureOperator, bindTarget, release, createDraft, updateDraft, getDraft, getDrafts, setCurrentDraftId]) m.mockReset()
        currentDraftId = null
        getDrafts.mockResolvedValue([])
        createDraft.mockResolvedValue({ id: 42 })
        getDraft.mockResolvedValue({ id: 9, name: "B", items: [], wizard_state: null, customer: null })
    })

    it("en MULTI no crea el borrador si se cancela el selector", async () => {
        ensureOperator.mockResolvedValue(false)
        const { result } = renderHook(() => useDrafts(), { wrapper })
        await act(async () => { await result.current.saveDraft(undefined, true) })
        expect(ensureOperator).toHaveBeenCalledWith("DRAFT")
        expect(createDraft).not.toHaveBeenCalled()
    })

    it("al crear el borrador liga el pase al borrador nuevo", async () => {
        ensureOperator.mockResolvedValue(true)
        const { result } = renderHook(() => useDrafts(), { wrapper })
        await act(async () => { await result.current.saveDraft(undefined, true) })
        expect(createDraft).toHaveBeenCalledTimes(1)
        expect(bindTarget).toHaveBeenCalledWith(42)
    })

    it("en MULTI pide operador con el id del borrador antes de bloquearlo", async () => {
        const order: string[] = []
        ensureOperator.mockImplementation(async () => { order.push("operator"); return true })
        const acquireLock = vi.fn(async () => { order.push("lock"); return { acquired: true } })
        const { result } = renderHook(() => useDrafts({ acquireLock }), { wrapper })
        let loaded = false
        await act(async () => { loaded = await result.current.loadDraft(9) })
        expect(ensureOperator).toHaveBeenCalledWith("DRAFT", { type: "sales.draftcart", id: 9 })
        expect(order).toEqual(["operator", "lock"])
        expect(loaded).toBe(true)
    })

    it("si se cancela el selector no bloquea ni carga el borrador", async () => {
        ensureOperator.mockResolvedValue(false)
        const acquireLock = vi.fn(async () => ({ acquired: true }))
        const { result } = renderHook(() => useDrafts({ acquireLock }), { wrapper })
        let loaded = true
        await act(async () => { loaded = await result.current.loadDraft(9) })
        expect(loaded).toBe(false)
        expect(acquireLock).not.toHaveBeenCalled()
        expect(getDraft).not.toHaveBeenCalled()
    })

    it("en SINGLE crea y carga borradores sin interfaz (ensureOperator resuelve true sin identificar)", async () => {
        // En SINGLE el provider resuelve true de inmediato: el flujo no cambia.
        ensureOperator.mockResolvedValue(true)
        const { result } = renderHook(() => useDrafts({ acquireLock: async () => ({ acquired: true }) }), { wrapper })
        await act(async () => { await result.current.saveDraft(undefined, true) })
        await act(async () => { await result.current.loadDraft(9) })
        expect(createDraft).toHaveBeenCalledTimes(1)
        expect(getDraft).toHaveBeenCalledTimes(1)
    })
})
