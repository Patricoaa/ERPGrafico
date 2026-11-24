import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SalesParams, ProductSales } from "../../analytics/sales.types"
import { useProductSales } from "../useProductSales"

const getProductSales = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductSales: (...a: unknown[]): unknown => getProductSales(...a) },
}))

const EMPTY: ProductSales = {
    kpis: {
        units: 0, net_revenue: 0, customers: 0, margin_pct: null, avg_discount_pct: 0,
        return_units: 0, return_rate_pct: 0,
        last_sale_date: null, days_since_last_sale: null, previous: null,
    },
    series: { points: [], previous_points: [] },
    customers: { total: 0, top3_share_pct: 0, top: [] },
    channels: [],
    variants: [],
    uoms: [],
}
const PARAMS: SalesParams = { granularity: "month", date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductSales.mockResolvedValue(EMPTY)
})

describe("useProductSales", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductSales(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductSales).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductSales(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductSales).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: SalesParams }) => useProductSales(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductSales.mockReturnValueOnce(new Promise<ProductSales>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductSales).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
