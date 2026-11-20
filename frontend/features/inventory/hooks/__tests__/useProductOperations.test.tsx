import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Operations, OperationsParams } from "../../analytics/operations.types"
import { useProductOperations } from "../useProductOperations"

const getProductOperations = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductOperations: (...a: unknown[]): unknown => getProductOperations(...a) },
}))

const EMPTY: Operations = { rotation: null, subscriptions: null }
const PARAMS: OperationsParams = { date_from: "2026-01-01", idle_days: 90 }

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductOperations.mockResolvedValue(EMPTY)
})

describe("useProductOperations", () => {
    it("passes the product id and params to the API", async () => {
        const { result } = renderHook(() => useProductOperations(7, PARAMS), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        expect(getProductOperations).toHaveBeenCalledWith(7, PARAMS)
    })

    it("is disabled without a product id", () => {
        const { result } = renderHook(() => useProductOperations(null, PARAMS), { wrapper: wrapper() })
        expect(result.current.data).toBeNull()
        expect(getProductOperations).not.toHaveBeenCalled()
    })

    it("keeps the previous data while new params load", async () => {
        let release: (value: Operations) => void = () => undefined
        const { result, rerender } = renderHook(
            ({ params }: { params: OperationsParams }) => useProductOperations(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductOperations.mockReturnValueOnce(new Promise<Operations>((resolve) => { release = resolve }))
        rerender({ params: { ...PARAMS, idle_days: 30 } })
        await waitFor(() => expect(getProductOperations).toHaveBeenCalledTimes(2))
        expect(result.current.data).toEqual(EMPTY)
        expect(result.current.isLoading).toBe(false)
        release({ rotation: null, subscriptions: null })
    })

    it("does not show data from another period while the new period loads", async () => {
        const { result, rerender } = renderHook(
            ({ params }: { params: OperationsParams }) => useProductOperations(7, params),
            { wrapper: wrapper(), initialProps: { params: PARAMS } },
        )
        await waitFor(() => expect(result.current.data).toEqual(EMPTY))
        getProductOperations.mockReturnValueOnce(new Promise<Operations>(() => undefined))
        rerender({ params: { ...PARAMS, date_from: undefined } })
        await waitFor(() => expect(getProductOperations).toHaveBeenCalledTimes(2))
        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(true)
    })
})
