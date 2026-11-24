import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductStockAnalysis, StockAnalysisParams } from "../../analytics/stockAnalysis.types"
import { useProductStockAnalysis } from "../useProductStockAnalysis"

const getProductStockAnalysis = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductStockAnalysis: (...a: unknown[]): unknown => getProductStockAnalysis(...a) },
}))

const EMPTY: ProductStockAnalysis = {
    today: { on_hand: 0, value: 0, reserved: 0, available: 0 },
    rotation: {
        in_qty: 0, out_qty: 0, avg_stock: 0, turnover: null, days_of_inventory: null,
        last_in_date: null, last_out_date: null, idle: false, idle_days: 90,
    },
    coverage: { coverage_days: null, daily_out: 0 },
    series: [],
    flows: { outflows: [], inflows: [] },
    adjustments: [],
    loss_pct: null,
    warehouses: [],
    variants: [],
}
const PARAMS: StockAnalysisParams = { granularity: "month", date_from: "2026-01-01", idle_days: 90 }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductStockAnalysis.mockResolvedValue(EMPTY)
})

describe("useProductStockAnalysis", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductStockAnalysis(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductStockAnalysis).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductStockAnalysis(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductStockAnalysis).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: StockAnalysisParams }) => useProductStockAnalysis(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductStockAnalysis.mockReturnValueOnce(new Promise<ProductStockAnalysis>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductStockAnalysis).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })

    it("keeps the previous data when only the idle threshold changes", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: StockAnalysisParams }) => useProductStockAnalysis(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductStockAnalysis.mockReturnValueOnce(new Promise<ProductStockAnalysis>(() => undefined))
        rerender({ params: { ...PARAMS, idle_days: 30 } })
        await waitFor(() => expect(getProductStockAnalysis).toHaveBeenCalledTimes(2))
        expect(result.current.data).toEqual(EMPTY)
    })
})
