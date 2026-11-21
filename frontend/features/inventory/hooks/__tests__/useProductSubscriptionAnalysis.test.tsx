import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductSubscriptionAnalysis, SubscriptionAnalysisParams } from "../../analytics/subscriptionAnalysis.types"
import { useProductSubscriptionAnalysis } from "../useProductSubscriptionAnalysis"

const getProductSubscriptionAnalysis = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductSubscriptionAnalysis: (...a: unknown[]): unknown => getProductSubscriptionAnalysis(...a) },
}))

const EMPTY: ProductSubscriptionAnalysis = {
    today: { annualized_total: 0, monthly_equivalent: 0, active_count: 0, due_90d_total: 0 },
    kpis: { paid: 0, payments: 0, previous: null },
    series: { points: [], previous_points: [] },
    subscriptions: [],
    payments: [],
}
const PARAMS: SubscriptionAnalysisParams = { granularity: "month", date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductSubscriptionAnalysis.mockResolvedValue(EMPTY)
})

describe("useProductSubscriptionAnalysis", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductSubscriptionAnalysis(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductSubscriptionAnalysis).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductSubscriptionAnalysis(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductSubscriptionAnalysis).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: SubscriptionAnalysisParams }) => useProductSubscriptionAnalysis(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductSubscriptionAnalysis.mockReturnValueOnce(new Promise<ProductSubscriptionAnalysis>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductSubscriptionAnalysis).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
