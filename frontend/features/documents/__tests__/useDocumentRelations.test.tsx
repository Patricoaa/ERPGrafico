import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock("@/lib/api", () => ({ default: { get: getMock } }))

import { useDocumentRelations } from "../hooks/useDocumentRelations"
import { relationsTotal } from "../utils/relationsTotal"

const ref = { label: "hr.employee", id: 5, display_id: "EMP-5", title: "Empleado", icon: null, domain: "hr", status: null, status_display: null, date: null, partner_name: null, url: null, accessible: true, exists: true }
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

describe("useDocumentRelations", () => {
    beforeEach(() => getMock.mockReset())

    it("asks for the recent window by default so sheets share the tab's request", async () => {
        getMock.mockResolvedValue({ data: { document: ref, relations: [], unresolved: [], hidden: {}, window: "recent" } })
        const { result } = renderHook(() => useDocumentRelations("hr.employee", 5), { wrapper })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(getMock).toHaveBeenCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "recent" } })
    })

    it("lets a caller ask for everything explicitly", async () => {
        getMock.mockResolvedValue({ data: { document: ref, relations: [], unresolved: [], hidden: {}, window: "all" } })
        const { result } = renderHook(() => useDocumentRelations("hr.employee", 5, { window: "all" }), { wrapper })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(getMock).toHaveBeenCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "all" } })
    })
})

describe("relationsTotal", () => {
    it("adds the hidden links to the visible ones", () => {
        expect(relationsTotal({ relations: [1, 2, 3], hidden: { hr: 4, accounting: 2 } } as never)).toBe(9)
    })
    it("is undefined without data and tolerates a missing hidden map", () => {
        expect(relationsTotal(undefined)).toBeUndefined()
        expect(relationsTotal({ relations: [1] } as never)).toBe(1)
    })
})
