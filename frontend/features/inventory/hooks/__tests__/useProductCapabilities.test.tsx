import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProductCapabilities } from "../../analytics/productAnalyticsRegistry"
import { useProductCapabilities } from "../useProducts"

const getProductCapabilities = vi.fn()

vi.mock("../../api/inventoryApi", () => ({
    inventoryApi: { getProductCapabilities: (...a: unknown[]): unknown => getProductCapabilities(...a) },
}))
vi.mock("@/features/realtime", () => ({ useRealtime: vi.fn() }))

const CAPS: ProductCapabilities = {
    sells: true, buys: false, tracks_stock: true, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
}

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    getProductCapabilities.mockResolvedValue(CAPS)
})

describe("useProductCapabilities", () => {
    it("carga las capacidades del producto indicado", async () => {
        const { result } = renderHook(() => useProductCapabilities(5), { wrapper: wrapper() })
        expect(result.current.capabilities).toBeNull()
        await waitFor(() => expect(result.current.capabilities).toEqual(CAPS))
        expect(getProductCapabilities).toHaveBeenCalledWith(5)
    })

    it("no consulta sin id de producto", () => {
        const { result } = renderHook(() => useProductCapabilities(null), { wrapper: wrapper() })
        expect(result.current.capabilities).toBeNull()
        expect(getProductCapabilities).not.toHaveBeenCalled()
    })
})
