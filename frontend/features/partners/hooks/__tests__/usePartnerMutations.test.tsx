import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PARTNERS_KEYS } from "@/features/contacts"
import { PARTNER_KEYS } from "../queryKeys"
import { usePartnerMutations } from "../usePartnerMutations"
import { useProfitDistributionMutations } from "../useProfitDistributionMutations"

const recordSubscription = vi.fn()
const executeProfitDistribution = vi.fn()
const markLocalMutation = vi.fn()

vi.mock("@/features/contacts/api/partnersApi", () => ({
    partnersApi: {
        recordSubscription: (...a: unknown[]): unknown => recordSubscription(...a),
        executeProfitDistribution: (...a: unknown[]): unknown => executeProfitDistribution(...a),
    },
}))
vi.mock("@/features/realtime", () => ({ useRealtime: () => ({ markLocalMutation }) }))

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return { invalidate, wrapper }
}

const invalidatedKeys = (spy: ReturnType<typeof setup>["invalidate"]) => spy.mock.calls.map(([f]) => f?.queryKey)

beforeEach(() => vi.clearAllMocks())

describe("mutaciones de socios", () => {
    it("la raíz de claves coincide con PARTNERS_KEYS de contacts", () => {
        expect(PARTNER_KEYS.all).toEqual(PARTNERS_KEYS.all)
        expect(PARTNER_KEYS.list()).toEqual(PARTNERS_KEYS.list())
    })

    it("una suscripción invalida el árbol de socios y marca la mutación local", async () => {
        recordSubscription.mockResolvedValue({})
        const { invalidate, wrapper } = setup()
        const { result } = renderHook(() => usePartnerMutations(), { wrapper })

        await act(() => result.current.recordSubscription.mutateAsync({ contact_id: 1, amount: 100, type: "SUBSCRIPTION" }))

        expect(recordSubscription).toHaveBeenCalledOnce()
        expect(markLocalMutation).toHaveBeenCalled()
        expect(invalidatedKeys(invalidate)).toContainEqual(PARTNER_KEYS.all)
    })

    it("ejecutar una distribución invalida el árbol de socios", async () => {
        executeProfitDistribution.mockResolvedValue({})
        const { invalidate, wrapper } = setup()
        const { result } = renderHook(() => useProfitDistributionMutations(), { wrapper })

        await act(() => result.current.execute.mutateAsync(7))

        expect(executeProfitDistribution).toHaveBeenCalledWith(7, expect.stringMatching(/^[0-9a-f-]{36}$/))
        await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual(PARTNER_KEYS.all))
    })

    it("si la API falla no invalida nada", async () => {
        recordSubscription.mockRejectedValue(new Error("boom"))
        const { invalidate, wrapper } = setup()
        const { result } = renderHook(() => usePartnerMutations(), { wrapper })

        await expect(act(() => result.current.recordSubscription.mutateAsync({ contact_id: 1, amount: 1, type: "SUBSCRIPTION" }))).rejects.toThrow("boom")
        expect(invalidate).not.toHaveBeenCalled()
    })
})
