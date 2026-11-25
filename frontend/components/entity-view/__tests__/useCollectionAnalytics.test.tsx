import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useCollectionAnalytics } from "@/components/entity-view"

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }))

vi.mock("next/navigation", () => ({
    useSearchParams: () => nav.params,
    usePathname: () => "/ventas/notas",
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
}))

beforeEach(() => {
    nav.params = new URLSearchParams()
    nav.push.mockReset()
    nav.replace.mockReset()
})

describe("useCollectionAnalytics (ADR-0158 §11)", () => {
    it("is closed on the default tab without ?analytics", () => {
        const { result } = renderHook(() => useCollectionAnalytics("resumen"))
        expect(result.current).toMatchObject({ open: false, tab: "resumen" })
        expect(nav.replace).not.toHaveBeenCalled()
    })

    it("opens on the tab named by ?analytics and keeps other params", () => {
        nav.params = new URLSearchParams("status=DRAFT&analytics=clientes")
        const { result } = renderHook(() => useCollectionAnalytics("resumen"))
        expect(result.current).toMatchObject({ open: true, tab: "clientes" })
        act(() => result.current.onTabChange("productos"))
        expect(nav.replace).toHaveBeenCalledWith("/ventas/notas?status=DRAFT&analytics=productos", { scroll: false })
        act(() => result.current.onOpenChange(false))
        expect(nav.push).toHaveBeenCalledWith("/ventas/notas?status=DRAFT", { scroll: false })
    })

    it("opening pushes the default tab", () => {
        const { result } = renderHook(() => useCollectionAnalytics("resumen"))
        act(() => result.current.onOpenChange(true))
        expect(nav.push).toHaveBeenCalledWith("/ventas/notas?analytics=resumen", { scroll: false })
    })

    it("rewrites the former ?view=analytics to ?analytics=<default>", () => {
        nav.params = new URLSearchParams("view=analytics&q=x")
        const { result } = renderHook(() => useCollectionAnalytics("resumen"))
        expect(result.current.open).toBe(true)
        expect(nav.replace).toHaveBeenCalledWith("/ventas/notas?q=x&analytics=resumen", { scroll: false })
    })

    it("rewrites legacy ?view=<tab> links listed by the page", () => {
        nav.params = new URLSearchParams("view=ventas")
        const { result } = renderHook(() => useCollectionAnalytics("resumen", { legacyViewTabs: ["ventas"] }))
        expect(result.current).toMatchObject({ open: true, tab: "ventas" })
        expect(nav.replace).toHaveBeenCalledWith("/ventas/notas?analytics=ventas", { scroll: false })
    })

    it("leaves layout values of ?view alone", () => {
        nav.params = new URLSearchParams("view=card")
        const { result } = renderHook(() => useCollectionAnalytics("resumen", { legacyViewTabs: ["ventas"] }))
        expect(result.current.open).toBe(false)
        expect(nav.replace).not.toHaveBeenCalled()
    })
})
