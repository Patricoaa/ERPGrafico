import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { toast } from "sonner"
import api from "@/lib/api"
import { useRecordById } from "../useRecordById"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const get = vi.mocked(api.get)

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return Wrapper
}

describe("useRecordById (ADR-0152)", () => {
    beforeEach(() => { get.mockReset(); vi.mocked(toast.error).mockReset() })

    it("loads the record from `${endpoint}/${id}/`", async () => {
        get.mockResolvedValue({ data: { id: 4, name: "Bodega" } } as never)
        const { result } = renderHook(() => useRecordById<{ id: number; name: string }>("/inventory/warehouses/", 4), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.record).toEqual({ id: 4, name: "Bodega" }))
        expect(get).toHaveBeenCalledWith("/inventory/warehouses/4/")
    })

    it("does not fetch without an id (the row was already provided)", () => {
        const { result } = renderHook(() => useRecordById("/inventory/uoms", null), { wrapper: wrapper() })
        expect(get).not.toHaveBeenCalled()
        expect(result.current.record).toBeNull()
    })

    it("reports a missing record with a toast and an error state", async () => {
        get.mockRejectedValue({ response: { status: 404 } })
        const { result } = renderHook(() => useRecordById("/inventory/uoms", 9), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(toast.error).toHaveBeenCalledWith("No encontrado", expect.anything())
    })
})
