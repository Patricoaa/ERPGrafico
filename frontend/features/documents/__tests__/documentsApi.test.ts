import { describe, it, expect, vi, beforeEach } from "vitest"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock("@/lib/api", () => ({ default: { get: getMock } }))

import { documentsApi } from "../api/documentsApi"

const ref = (domain: string) => ({
    label: "hr.payroll", id: 1, display_id: "LIQ-1", title: "Liquidación", icon: null, domain,
    status: null, status_display: null, date: null, partner_name: null, url: null, accessible: true, exists: true,
})

describe("documentsApi.getRelations", () => {
    beforeEach(() => getMock.mockReset())

    it("sends the window filter as a query param", async () => {
        getMock.mockResolvedValue({ data: { document: ref("hr"), relations: [], unresolved: [] } })
        await documentsApi.getRelations("hr.employee", 5, { window: "recent" })
        expect(getMock).toHaveBeenCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "recent" } })
    })

    it("defaults hidden to {} and window to 'all' when the response omits them", async () => {
        getMock.mockResolvedValue({ data: { document: ref("hr"), relations: [], unresolved: [] } })
        const result = await documentsApi.getRelations("hr.employee", 5)
        expect(result.hidden).toEqual({})
        expect(result.window).toBe("all")
    })

    it("keeps the hr domain instead of falling back to 'other'", async () => {
        getMock.mockResolvedValue({
            data: {
                document: ref("hr"),
                relations: [{ semantic: "association", direction: "outgoing", role: "payroll", target: ref("hr"), amount: null, quantity: null, is_dependency: false }],
                unresolved: [], hidden: { hr: 3 }, window: "recent",
            },
        })
        const result = await documentsApi.getRelations("hr.employee", 5, { window: "recent" })
        expect(result.relations[0].target.domain).toBe("hr")
        expect(result.hidden).toEqual({ hr: 3 })
    })
})
