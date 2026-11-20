import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductionPerformance, ProductionPerformanceParams } from "../../analytics/productionPerformance.types"
import { useProductProductionPerformance } from "../useProductProductionPerformance"

const getProductProductionPerformance = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: {
        getProductProductionPerformance: (...a: unknown[]): unknown => getProductProductionPerformance(...a),
    },
}))

const EMPTY: ProductionPerformance = {
    kpis: { orders: 0, unit_real_cost: 0, bom_cost: 0, bom_gap_pct: 0, deviation_pct: 0, lead_time_days: 0, rectification_rate: 0 },
    orders: [], materials: [], stages: [],
}
const PARAMS: ProductionPerformanceParams = { date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductProductionPerformance.mockResolvedValue(EMPTY)
})

describe("useProductProductionPerformance", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductProductionPerformance(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductProductionPerformance).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductProductionPerformance(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductProductionPerformance).not.toHaveBeenCalled()
    })

    it("refetches when params change", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: ProductionPerformanceParams }) => useProductProductionPerformance(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        rerender({ params: { date_from: "2025-01-01" } })
        await waitFor(() => expect(getProductProductionPerformance).toHaveBeenCalledTimes(2))
    })
})
