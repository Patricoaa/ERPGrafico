import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useUniversalSearch } from "../useUniversalSearch"

vi.mock("../../api/searchApi", () => ({
    searchApi: { search: vi.fn(async () => [{ label: "sales.saleorder", id: 7, display: "OV-7", title: "Orden", title_plural: "Órdenes", icon: "receipt", content_type_id: 1 }]) },
}))

describe("useUniversalSearch", () => {
    it("no conserva resultados de una búsqueda anterior cuando la consulta queda corta", async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
        const { result, rerender } = renderHook(({ q }) => useUniversalSearch(q), { wrapper, initialProps: { q: "ov" } })
        await waitFor(() => expect(result.current.results).toHaveLength(1))
        rerender({ q: "" })
        expect(result.current.results).toEqual([])
    })
})
