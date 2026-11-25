import { describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { useCollectionAnalytics, type UseCollectionAnalyticsOptions } from "@/components/entity-view"

function setup(search = "", options?: UseCollectionAnalyticsOptions) {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
            {children}
        </NuqsTestingAdapter>
    )
    const hook = renderHook(() => useCollectionAnalytics("resumen", options), { wrapper })
    const last = () => onUrlUpdate.mock.calls.at(-1)?.[0]
    return { ...hook, onUrlUpdate, last }
}

describe("useCollectionAnalytics (ADR-0158 §11)", () => {
    it("is closed on the default tab without ?analytics", () => {
        const { result, onUrlUpdate } = setup()
        expect(result.current).toMatchObject({ open: false, tab: "resumen", scope: "query" })
        expect(onUrlUpdate).not.toHaveBeenCalled()
    })

    it("opens on the tab named by ?analytics and keeps other params", async () => {
        const { result, last } = setup("status=DRAFT&analytics=clientes")
        expect(result.current).toMatchObject({ open: true, tab: "clientes" })
        act(() => result.current.onTabChange("productos"))
        await waitFor(() => expect(last()?.queryString).toBe("?status=DRAFT&analytics=productos"))
        expect(last()?.options.history).toBe("replace")
        act(() => result.current.onOpenChange(false))
        await waitFor(() => expect(last()?.queryString).toBe("?status=DRAFT"))
        expect(last()?.options.history).toBe("push")
    })

    it("opening pushes the default tab", async () => {
        const { result, last } = setup()
        act(() => result.current.onOpenChange(true))
        await waitFor(() => expect(last()?.queryString).toBe("?analytics=resumen"))
        expect(last()?.options.history).toBe("push")
    })

    it("rewrites the former ?view=analytics to ?analytics=<default>", async () => {
        const { result, last } = setup("view=analytics&q=x")
        expect(result.current.open).toBe(true)
        await waitFor(() => expect(last()?.queryString).toBe("?q=x&analytics=resumen"))
        expect(last()?.options.history).toBe("replace")
    })

    it("rewrites legacy ?view=<tab> links listed by the page", async () => {
        const { result, last } = setup("view=ventas", { legacyViewTabs: ["ventas"] })
        expect(result.current).toMatchObject({ open: true, tab: "ventas" })
        await waitFor(() => expect(last()?.queryString).toBe("?analytics=ventas"))
    })

    it("leaves layout values of ?view alone", () => {
        const { result, onUrlUpdate } = setup("view=card", { legacyViewTabs: ["ventas"] })
        expect(result.current.open).toBe(false)
        expect(onUrlUpdate).not.toHaveBeenCalled()
    })

    it("«Analizar sin filtros» widens the scope until the modal closes", async () => {
        const { result } = setup("analytics=resumen")
        act(() => result.current.onScopeChange("all"))
        expect(result.current.scope).toBe("all")
        act(() => result.current.onOpenChange(false))
        await waitFor(() => expect(result.current.open).toBe(false))
        expect(result.current.scope).toBe("query")
    })
})
