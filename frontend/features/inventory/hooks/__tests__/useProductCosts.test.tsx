import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CostsParams, ProductCosts } from "../../analytics/costs.types"
import { useProductCosts } from "../useProductCosts"

const getProductCosts = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductCosts: (...a: unknown[]): unknown => getProductCosts(...a) },
}))

const EMPTY: ProductCosts = {
    mode: "purchased",
    today: { weighted_cost: 0, bom_cost: null, last_purchase: null, stock_qty: null, stock_value: null },
    kpis: { cost_change_pct: null, replacement_gap_pct: null },
    series: [],
    purchases: { min: null, max: null, avg: null, count: 0, items: [] },
    bom: null,
    work_orders: [],
}
const PARAMS: CostsParams = { granularity: "month", date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductCosts.mockResolvedValue(EMPTY)
})

describe("useProductCosts", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductCosts(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductCosts).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductCosts(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductCosts).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: CostsParams }) => useProductCosts(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductCosts.mockReturnValueOnce(new Promise<ProductCosts>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductCosts).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
