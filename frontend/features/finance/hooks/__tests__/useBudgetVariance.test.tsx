import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FINANCE_KEYS } from "../queryKeys"
import { useBudgetVariance } from "../useBudgets"

const m = vi.hoisted(() => ({ getBudgetVariance: vi.fn() }))

vi.mock("../../api/financeApi", () => ({
    financeApi: { getBudgetVariance: m.getBudgetVariance },
}))

describe("useBudgetVariance", () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        m.getBudgetVariance.mockResolvedValue([])
    })

    it("sepera en caché los periodos: cambiar mes pide datos nuevos", async () => {
        const { rerender } = renderHook(
            ({ params }: { params: Record<string, string> }) => useBudgetVariance(604, params),
            { initialProps: { params: { month: "3", year: "2025" } }, wrapper },
        )
        await waitFor(() => expect(m.getBudgetVariance).toHaveBeenCalledTimes(1))

        rerender({ params: { month: "4", year: "2025" } })
        await waitFor(() => expect(m.getBudgetVariance).toHaveBeenCalledTimes(2))

        const keys = queryClient.getQueryCache().getAll().map((q) => q.queryKey)
        expect(keys).toContainEqual(FINANCE_KEYS.budgets.variance(604, { month: "3", year: "2025" }))
        expect(keys).toContainEqual(FINANCE_KEYS.budgets.variance(604, { month: "4", year: "2025" }))
    })
})
