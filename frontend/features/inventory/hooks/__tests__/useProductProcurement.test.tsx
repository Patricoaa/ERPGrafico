import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProcurementParams, ProductProcurement } from "../../analytics/procurement.types"
import { useProductProcurement } from "../useProductProcurement"

const getProductProcurement = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductProcurement: (...a: unknown[]): unknown => getProductProcurement(...a) },
}))

const EMPTY: ProductProcurement = {
    coverage: null,
    kpis: {
        units: 0, spend: 0, orders: 0, suppliers: 0, last_purchase_date: null, days_since_last_purchase: null,
        returned_units: 0, previous: null,
    },
    series: { points: [], previous_points: [] },
    suppliers: [],
    preferred_supplier: null,
    pending: [],
}
const PARAMS: ProcurementParams = { granularity: "month", date_from: "2026-01-01" }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductProcurement.mockResolvedValue(EMPTY)
})

describe("useProductProcurement", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductProcurement(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductProcurement).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductProcurement(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductProcurement).not.toHaveBeenCalled()
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: ProcurementParams }) => useProductProcurement(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductProcurement.mockReturnValueOnce(new Promise<ProductProcurement>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductProcurement).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
