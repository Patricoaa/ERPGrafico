import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SalesImpact, SalesImpactParams } from "../../analytics/salesImpact.types"
import { useProductSalesImpact } from "../useProductSalesImpact"

const getProductSalesImpact = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: {
        getProductSalesImpact: (...a: unknown[]): unknown => getProductSalesImpact(...a),
    },
}))

const EMPTY: SalesImpact = {
    series: [], segments: [], table: [],
    totals: { units: 0, net_revenue: 0, margin: 0, margin_pct: 0, discount_total: 0, foregone_revenue: 0 },
    returns: { units: 0, revenue: 0 },
    coverage: { revenue_with_provenance_pct: 0, since: null },
    rule_windows: [],
}
const PARAMS: SalesImpactParams = { metric: "net_revenue", group_by: "rule", granularity: "month" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductSalesImpact.mockResolvedValue(EMPTY)
})

describe("useProductSalesImpact", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductSalesImpact(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductSalesImpact).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductSalesImpact(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductSalesImpact).not.toHaveBeenCalled()
    })

    it("refetches when params change", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: SalesImpactParams }) => useProductSalesImpact(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        rerender({ params: { ...PARAMS, group_by: "channel" } })
        await waitFor(() => expect(getProductSalesImpact).toHaveBeenCalledTimes(2))
        expect(getProductSalesImpact).toHaveBeenLastCalledWith(7, { ...PARAMS, group_by: "channel" })
    })
})
