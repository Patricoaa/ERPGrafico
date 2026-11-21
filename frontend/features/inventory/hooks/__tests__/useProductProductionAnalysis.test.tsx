import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductionAnalysisParams, ProductProductionAnalysis } from "../../analytics/productionAnalysis.types"
import { useProductProductionAnalysis } from "../useProductProductionAnalysis"

const getProductProductionAnalysis = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductProductionAnalysis: (...a: unknown[]): unknown => getProductProductionAnalysis(...a) },
}))

const EMPTY: ProductProductionAnalysis = { made: null, input: null }
const PARAMS: ProductionAnalysisParams = { granularity: "month", date_from: "2026-01-01", increase_pct: 10 }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductProductionAnalysis.mockResolvedValue(EMPTY)
})

describe("useProductProductionAnalysis", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductProductionAnalysis(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductProductionAnalysis).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductProductionAnalysis(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductProductionAnalysis).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: ProductionAnalysisParams }) => useProductProductionAnalysis(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductProductionAnalysis.mockReturnValueOnce(new Promise<ProductProductionAnalysis>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductProductionAnalysis).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })

    it("keeps the previous data when only the price increase changes", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: ProductionAnalysisParams }) => useProductProductionAnalysis(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductProductionAnalysis.mockReturnValueOnce(new Promise<ProductProductionAnalysis>(() => undefined))
        rerender({ params: { ...PARAMS, increase_pct: 20 } })
        await waitFor(() => expect(getProductProductionAnalysis).toHaveBeenCalledTimes(2))
        expect(result.current.data).toEqual(EMPTY)
    })
})
