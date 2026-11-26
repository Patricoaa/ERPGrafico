import { describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import type { ReactNode } from "react"
import { compileQuery, defineEntity, orderingFor, useCollectionQuery } from "@/components/entity-view"

interface Note {
    id: number
    number: string
    customer: string
    status: string
    date: string
    total: string
}

const noteEntity = defineEntity<Note>()((f) => ({
    title: "Notas de venta",
    fields: {
        number: f.code("number", { label: "Folio", orderBy: "number" }),
        customer: f.text("customer", { label: "Cliente", orderBy: "customer__name", groupKey: "customer" }),
        status: f.text("status", { label: "Estado", groupKey: "status" }),
        date: f.date("date", { label: "Fecha", orderBy: "date" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
    },
    query: {
        search: { scopes: [{ field: "customer", param: "customer_name", suggestionsUrl: "sales/orders/filter-suggestions/" }] },
        filters: {
            status: { field: "status", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "CONFIRMED", label: "Confirmada" }] },
            date: { field: "date", control: "date", presets: ["today", "this_month"] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
            overdue: { control: "toggle", label: "Solo vencidas" },
            seller: { control: "single", label: "Vendedor", options: "remote" },
        },
        sort: { fields: ["date", "total", "number"], default: "-date" },
        groupBy: { fields: ["status", "customer"], aggregate: { total: "sum" } },
        views: [
            { id: "all", label: "Todas" },
            { id: "open", label: "En curso", filters: { status: ["DRAFT", "CONFIRMED"] }, ordering: ["-total"] },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" }, groupBy: "customer" },
        ],
    },
}))

describe("compileQuery (ADR-0158 §3)", () => {
    const compiled = compileQuery(noteEntity)

    it("takes filter and scope labels from the fields (G-1) and fills param defaults", () => {
        const byKey = Object.fromEntries((compiled.search.filters ?? []).map((f) => [f.key, f]))
        expect(byKey.status).toMatchObject({ type: "multi", label: "Estado", serverParam: "status" })
        expect(byKey.total).toMatchObject({ type: "range", label: "Total", serverParamFrom: "total_min", serverParamTo: "total_max" })
        expect(byKey.overdue).toMatchObject({ type: "toggle", label: "Solo vencidas", serverParam: "overdue", activeValue: "true" })
        expect(byKey.seller).toMatchObject({ type: "single", label: "Vendedor", dynamic: true, options: [] })
        expect(compiled.search.searchFields).toEqual([{ key: "customer_name", label: "Cliente", serverParam: "customer_name", suggestionsUrl: "sales/orders/filter-suggestions/" }])
    })

    it("turns date presets into shared date-filter options with _after/_before defaults", () => {
        const [date] = compiled.search.dateFilters ?? []
        expect(date.label).toBe("Fecha")
        expect(date.options.map((o) => [o.label, o.serverParamFrom, o.serverParamTo])).toEqual([
            ["Hoy", "date_after", "date_before"],
            ["Este mes", "date_after", "date_before"],
        ])
        expect(date.options[0].getValue?.().from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(compiled.filterParams.date).toEqual(["date_after", "date_before"])
    })

    it("compiles grouping and sorting from the field labels and server keys", () => {
        expect(compiled.search.groupBy).toEqual([
            { key: "status", label: "Estado", field: "status" },
            { key: "customer", label: "Cliente", field: "customer" },
        ])
        expect(compiled.sortFields.map((f) => f.orderBy)).toEqual(["date", "total", "number"])
        expect(compiled.defaultSort).toEqual(["-date"])
        expect(compiled.aggregate).toEqual({ total: "sum" })
    })

    it("builds a DRF ordering with one id tie-break, at most three keys", () => {
        expect(orderingFor(compiled, ["-date", "total"])).toBe("-date,total,-id")
        expect(orderingFor(compiled, ["number", "-date", "total", "-total"])).toBe("number,-date,total,id")
        expect(orderingFor(compiled, ["status"])).toBeUndefined()
    })

    it("rejects a sort field without orderBy at definition time", () => {
        const bad = defineEntity<Note>()((f) => ({
            title: "x",
            fields: { status: f.text("status", { label: "Estado" }) },
            query: { sort: { fields: ["status"] } },
        }))
        expect(() => compileQuery(bad)).toThrow(/orderBy/)
    })

    it("rejects a server-mode group field without groupKey; client mode groups the loaded rows", () => {
        const bad = defineEntity<Note>()((f) => ({
            title: "x",
            fields: { status: f.text("status", { label: "Estado" }) },
            query: { groupBy: { fields: ["status"] } },
        }))
        expect(() => compileQuery(bad)).toThrow(/groupKey/)
        expect(compileQuery(bad, { sorting: "client" }).groupFields).toEqual([{ id: "status", label: "Estado", groupKey: null }])
    })
})

describe("query type guarantees", () => {
    it("rejects unknown field ids and a label next to a field", () => {
        defineEntity<Note>()((f) => ({
            title: "x",
            fields: { status: f.text("status", { label: "Estado" }) },
            query: {
                filters: {
                    // @ts-expect-error — "estado" is not a field id
                    a: { field: "estado", control: "toggle" },
                    // @ts-expect-error — a field filter takes the field label (G-1)
                    b: { field: "status", label: "Otro", control: "toggle" },
                    // @ts-expect-error — a filter without a field needs its own label
                    c: { control: "toggle" },
                },
                // @ts-expect-error — "nope" is not a field id
                groupBy: { fields: ["nope"] },
            },
        }))
        expect(true).toBe(true)
    })
})

function harness(search = "", urlPrefix?: string) {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>{children}</NuqsTestingAdapter>
    )
    const hook = renderHook(() => useCollectionQuery(noteEntity, { urlPrefix }), { wrapper })
    const lastUrl = () => onUrlUpdate.mock.lastCall?.[0].queryString ?? ""
    return { ...hook, onUrlUpdate, lastUrl }
}

describe("useCollectionQuery (ADR-0158 §4)", () => {
    it("namespaces its URL keys with urlPrefix and leaves the page's own params alone", async () => {
        const { result, lastUrl } = harness("?status=CONFIRMED&ledger_status=DRAFT&ledger_ordering=total", "ledger_")
        expect(result.current.search.paramValues.status).toBe("DRAFT")
        expect(result.current.params).toEqual({ status: "DRAFT", ordering: "total,id" })
        act(() => void result.current.search.applyFilter("search", "kilo"))
        act(() => result.current.setSort(["-number"]))
        await waitFor(() => expect(lastUrl()).toContain("ledger_ordering=-number"))
        expect(lastUrl()).toContain("ledger_search=kilo")
        expect(lastUrl()).toContain("status=CONFIRMED")
        expect(lastUrl()).not.toMatch(/(^|[?&])ordering=/)
        expect(result.current.params).toMatchObject({ search: "kilo", status: "DRAFT", ordering: "-number,-id" })
    })

    it("starts on the default view and default sort, with list params ready for the request", () => {
        const { result } = harness("?status=DRAFT&search=kilo")
        expect(result.current.activeView?.id).toBe("all")
        expect(result.current.sort).toEqual(["-date"])
        expect(result.current.ordering).toBe("-date,-id")
        expect(result.current.params).toEqual({ status: "DRAFT", search: "kilo", ordering: "-date,-id" })
        expect(result.current.isDirty).toBe(true)
    })

    it("reads multi-key ordering from the URL, dropping unknown and extra keys", () => {
        const { result } = harness("?ordering=-total,status,number,date,-number")
        expect(result.current.sort).toEqual(["-total", "number", "date"])
        expect(result.current.ordering).toBe("-total,number,date,-id")
    })

    it("writes the sort and the header's first key through `sorting`", async () => {
        const { result, lastUrl } = harness("?ordering=-date,total")
        act(() => result.current.sorting.onChange("number"))
        // The header replaces the first key and keeps the secondary ones.
        await waitFor(() => expect(result.current.sort).toEqual(["number", "total"]))
        expect(lastUrl()).toContain("ordering=number,total")
        act(() => result.current.setSort([]))
        await waitFor(() => expect(result.current.sort).toEqual([]))
        expect(result.current.ordering).toBeUndefined()
    })

    it("applies a view's filters, ordering and grouping in one go, and resets to it", async () => {
        const { result } = harness("?search=kilo")
        act(() => result.current.setView("open"))
        await waitFor(() => expect(result.current.activeView?.id).toBe("open"))
        await waitFor(() => expect(result.current.search.paramValues).toMatchObject({ status: "DRAFT,CONFIRMED", search: null }))
        expect(result.current.sort).toEqual(["-total"])
        expect(result.current.isDirty).toBe(false)

        act(() => void result.current.search.applyFilter("total_min", "500000"))
        await waitFor(() => expect(result.current.isDirty).toBe(true))
        act(() => result.current.resetView())
        await waitFor(() => expect(result.current.search.paramValues.total_min).toBeNull())
        expect(result.current.isDirty).toBe(false)

        act(() => result.current.setView("drafts"))
        await waitFor(() => expect(result.current.groupBy).toBe("customer"))
        expect(result.current.search.paramValues.status).toBe("DRAFT")
    })

    it("ignores a group_by that the query does not declare", () => {
        const { result } = harness("?group_by=total")
        expect(result.current.groupBy).toBeNull()
    })
})
