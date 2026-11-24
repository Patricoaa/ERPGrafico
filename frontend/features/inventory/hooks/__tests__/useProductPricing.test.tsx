import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PricingParams, ProductPricing } from "../../analytics/pricing.types"
import { useProductPricing } from "../useProductPricing"

const getProductPricing = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductPricing: (...a: unknown[]): unknown => getProductPricing(...a) },
}))

const EMPTY: ProductPricing = {
    has_cost: false,
    today: { list_price_net: 0, list_price_gross: 0, cost: 0, list_margin_pct: null },
    kpis: { margin_pct: null, net_revenue: 0, units: 0, avg_price: 0, avg_discount_pct: 0, foregone_revenue: 0, previous: null },
    series: { points: [], by_rule: [] },
    list_price_changes: { baseline: null, changes: [] },
    rule_windows: [],
    effects: [],
}
const PARAMS: PricingParams = { granularity: "month", date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductPricing.mockResolvedValue(EMPTY)
})

describe("useProductPricing", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductPricing(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductPricing).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductPricing(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductPricing).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: PricingParams }) => useProductPricing(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductPricing.mockReturnValueOnce(new Promise<ProductPricing>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductPricing).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
