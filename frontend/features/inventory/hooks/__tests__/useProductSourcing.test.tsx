import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Sourcing, SourcingParams } from "../../analytics/sourcing.types"
import { useProductSourcing } from "../useProductSourcing"

const getProductSourcing = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductSourcing: (...a: unknown[]): unknown => getProductSourcing(...a) },
}))

const EMPTY: Sourcing = { make_vs_buy: null, used_in: null }
const PARAMS: SourcingParams = { date_from: "2026-01-01", increase_pct: 10 }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductSourcing.mockResolvedValue(EMPTY)
})

describe("useProductSourcing", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductSourcing(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductSourcing).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductSourcing(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductSourcing).not.toHaveBeenCalled()
    })

    it("refetches when params change", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: SourcingParams }) => useProductSourcing(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        rerender({ params: { ...PARAMS, increase_pct: 20 } })
        await waitFor(() => expect(getProductSourcing).toHaveBeenCalledTimes(2))
    })
})
