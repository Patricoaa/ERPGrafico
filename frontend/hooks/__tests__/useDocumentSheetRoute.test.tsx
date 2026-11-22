import { renderHook, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { useDocumentSheetRoute } from "../useDocumentSheetRoute"

const m = vi.hoisted(() => ({ openEntity: vi.fn(), activeEntity: null as { label: string; id: number } | null, deepLink: vi.fn() }))

vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: m.openEntity, activeEntity: m.activeEntity }),
}))
vi.mock("@/hooks/useDeepLinkEntity", () => ({ useDeepLinkEntity: m.deepLink }))

describe("useDocumentSheetRoute (ADR-0152)", () => {
    beforeEach(() => { m.openEntity.mockReset(); m.deepLink.mockReset(); m.activeEntity = null })

    it("toggle opens each document in its own tab, passing the row as data", () => {
        const { result } = renderHook(() => useDocumentSheetRoute("sales.saleorder"))
        act(() => { result.current.toggle(1, { id: 1 }); result.current.toggle(2, { id: 2 }) })
        expect(m.openEntity).toHaveBeenNthCalledWith(1, "sales.saleorder", 1, { id: 1 })
        expect(m.openEntity).toHaveBeenNthCalledWith(2, "sales.saleorder", 2, { id: 2 })
        expect(m.deepLink).toHaveBeenCalledWith("sales.saleorder")
    })

    it("highlights the row of the active tab only when it belongs to this list", () => {
        m.activeEntity = { label: "sales.saleorder", id: 5 }
        expect(renderHook(() => useDocumentSheetRoute("sales.saleorder")).result.current).toMatchObject({ selectedId: 5, isOpen: true })
        expect(renderHook(() => useDocumentSheetRoute("billing.invoice")).result.current).toMatchObject({ selectedId: null, isOpen: false })
    })

    it("does nothing without a label (embedded lists such as the POS)", () => {
        const { result } = renderHook(() => useDocumentSheetRoute(null))
        act(() => result.current.toggle(1, {}))
        expect(m.openEntity).not.toHaveBeenCalled()
        expect(result.current.selectedId).toBeNull()
    })
})
