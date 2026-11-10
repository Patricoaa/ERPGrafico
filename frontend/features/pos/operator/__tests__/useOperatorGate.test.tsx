import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPosOperatorHeaders, runPosOperatorChallenge, setPosOperatorChallengeHandler, setPosOperatorHeaders } from "@/lib/pos-operator"
import { OperatorGateProvider } from "../OperatorGateProvider"
import { operatorStore } from "../operatorStore"
import { useOperatorGate } from "../useOperatorGate"

type Session = { id: number; mode: "SINGLE" | "MULTI" } | null
let session: Session = { id: 5, mode: "MULTI" }
let currentDraftId: number | null = null

const identify = vi.fn()
const releaseOperator = vi.fn()

vi.mock("../../contexts/POSProvider", () => ({ usePOS: () => ({ currentSession: session, currentDraftId }) }))
vi.mock("../../hooks/useDraftSync", () => ({ getBrowserSessionKey: () => "tab-1" }))
vi.mock("../../api/posApi", () => ({ posApi: { releaseOperator: (...a: unknown[]): unknown => releaseOperator(...a) } }))
vi.mock("../useOperators", () => ({
    useOperators: () => ({
        data: [{ id: 1, username: "ana", full_name: "Ana Pérez", initials: "AP" }, { id: 2, username: "beto", full_name: "Beto Soto", initials: "BS" }],
        isLoading: false, isError: false, refetch: vi.fn(),
    }),
    useIdentifyOperator: () => ({ mutateAsync: (...a: unknown[]): unknown => identify(...a), isPending: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
    return <OperatorGateProvider>{children}</OperatorGateProvider>
}

function passFor(op: { id: number; name: string }, purpose: string, targetId: number | null = null) {
    return { token: `tok-${op.id}-${purpose}-${targetId}`, pass_id: 1, operator: { id: op.id, full_name: op.name }, purpose, expires_at: null }
}

async function choose(name: RegExp) {
    fireEvent.click(await screen.findByRole("button", { name }))
}

beforeEach(() => {
    session = { id: 5, mode: "MULTI" }
    currentDraftId = null
    identify.mockReset()
    releaseOperator.mockReset().mockResolvedValue(undefined)
    identify.mockImplementation(async ({ payload }: { payload: { operator_id: number; purpose: string; target_id?: number } }) =>
        passFor({ id: payload.operator_id, name: payload.operator_id === 1 ? "Ana Pérez" : "Beto Soto" }, payload.purpose, payload.target_id ?? null))
})

afterEach(() => {
    operatorStore.reset()
    setPosOperatorHeaders(null)
    setPosOperatorChallengeHandler(null)
})

describe("useOperatorGate", () => {
    it("en SINGLE resuelve true sin abrir el selector ni llamar a la API", async () => {
        session = { id: 5, mode: "SINGLE" }
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        expect(result.current.isMultiUser).toBe(false)
        let ok = false
        await act(async () => { ok = await result.current.ensureOperator("DRAFT") })
        expect(ok).toBe(true)
        expect(screen.queryByText("¿Quién opera?")).toBeNull()
        expect(identify).not.toHaveBeenCalled()
        expect(getPosOperatorHeaders()).toEqual({})
    })

    it("fuera del POS (sin provider) no exige nada", async () => {
        const { result } = renderHook(() => useOperatorGate())
        expect(result.current.isMultiUser).toBe(false)
        expect(await result.current.ensureOperator("CASH_MOVEMENT")).toBe(true)
    })

    it("en MULTI abre el selector, identifica y deja el pase en los encabezados", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let promise!: Promise<boolean>
        act(() => { promise = result.current.ensureOperator("DRAFT") })
        await choose(/Ana Pérez/)
        await expect(promise).resolves.toBe(true)
        expect(identify).toHaveBeenCalledWith({ sessionId: 5, payload: { operator_id: 1, tab_key: "tab-1", purpose: "DRAFT" } })
        expect(getPosOperatorHeaders()["X-POS-Operator-Pass"]).toBe("tok-1-DRAFT-null")
        await waitFor(() => expect(result.current.activePass?.operator.full_name).toBe("Ana Pérez"))
    })

    it("reutiliza el pase vigente del mismo propósito y destino", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("CASH_MOVEMENT") })
        await choose(/Ana/); await p
        let again = false
        await act(async () => { again = await result.current.ensureOperator("CASH_MOVEMENT") })
        expect(again).toBe(true)
        expect(identify).toHaveBeenCalledTimes(1)
    })

    it("pide uno nuevo si cambia el propósito o el destino", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT", { type: "sales.draftcart", id: 3 }) })
        await choose(/Ana/); await p
        expect((identify.mock.calls[0]![0] as { payload: unknown }).payload).toMatchObject({ target_type: "sales.draftcart", target_id: 3 })
        act(() => { p = result.current.ensureOperator("DRAFT", { type: "sales.draftcart", id: 4 }) })
        await choose(/Beto/); await p
        act(() => { p = result.current.ensureOperator("SESSION_CLOSE") })
        await choose(/Ana/); await p
        expect(identify).toHaveBeenCalledTimes(3)
    })

    it("cancelar resuelve false y no deja encabezados", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT") })
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }))
        await expect(p).resolves.toBe(false)
        expect(getPosOperatorHeaders()).toEqual({})
        expect(result.current.activePass).toBeNull()
    })

    it("release avisa al backend y limpia el estado", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT") })
        await choose(/Ana/); await p
        await act(async () => { await result.current.release() })
        expect(releaseOperator).toHaveBeenCalledWith(5)
        expect(getPosOperatorHeaders()).toEqual({})
        expect(result.current.activePass).toBeNull()
    })

    it("release sin pase no llama al backend", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        await act(async () => { await result.current.release() })
        expect(releaseOperator).not.toHaveBeenCalled()
    })

    it("responde al desafío del interceptor deduciendo el borrador de la url", async () => {
        renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = runPosOperatorChallenge("DRAFT", { url: "sales/pos-drafts/12/" }) })
        await choose(/Beto/)
        await expect(p).resolves.toBe(true)
        expect((identify.mock.calls[0]![0] as { payload: unknown }).payload).toMatchObject({ operator_id: 2, purpose: "DRAFT", target_type: "sales.draftcart", target_id: 12 })
    })

    it("el desafío del cobro (url sin borrador) liga el pase al borrador en curso", async () => {
        currentDraftId = 12
        renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = runPosOperatorChallenge("DRAFT", { url: "sales/orders/" }) })
        await choose(/Beto/)
        await expect(p).resolves.toBe(true)
        expect((identify.mock.calls[0]![0] as { payload: unknown }).payload).toMatchObject({ purpose: "DRAFT", target_type: "sales.draftcart", target_id: 12 })
    })

    it("el desafío descarta el pase muerto antes de pedir otro", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT", { type: "sales.draftcart", id: 12 }) })
        await choose(/Ana/); await p
        act(() => { p = runPosOperatorChallenge("DRAFT", { url: "sales/pos-drafts/12/" }) })
        await choose(/Beto/); await p
        expect(identify).toHaveBeenCalledTimes(2)
        expect(result.current.activePass?.operator.id).toBe(2)
    })

    it("usa el destino fijado con setChallengeTarget para propósitos sin url (documento)", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        act(() => result.current.setChallengeTarget("DOCUMENT_EDIT", { type: "sales.saleorder", id: 40 }))
        let p!: Promise<boolean>
        act(() => { p = runPosOperatorChallenge("DOCUMENT_EDIT", { url: "contacts/9/" }) })
        await choose(/Ana/); await p
        expect((identify.mock.calls[0]![0] as { payload: unknown }).payload).toMatchObject({ purpose: "DOCUMENT_EDIT", target_type: "sales.saleorder", target_id: 40 })
    })

    it("bindTarget liga el pase al borrador creado y permite reutilizarlo", async () => {
        const { result } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT") })
        await choose(/Ana/); await p
        act(() => result.current.bindTarget(31))
        expect(result.current.activePass?.targetId).toBe(31)
        let again = false
        await act(async () => { again = await result.current.ensureOperator("DRAFT", { type: "sales.draftcart", id: 31 }) })
        expect(again).toBe(true)
        expect(identify).toHaveBeenCalledTimes(1)
    })

    it("limpia el pase cuando la sesión deja de ser multiusuario", async () => {
        const { result, rerender } = renderHook(() => useOperatorGate(), { wrapper })
        let p!: Promise<boolean>
        act(() => { p = result.current.ensureOperator("DRAFT") })
        await choose(/Ana/); await p
        session = null
        rerender()
        await waitFor(() => expect(result.current.activePass).toBeNull())
        expect(getPosOperatorHeaders()).toEqual({})
    })
})
