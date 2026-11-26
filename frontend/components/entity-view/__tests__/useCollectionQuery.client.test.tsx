import { describe, expect, it, vi } from "vitest"
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { Collection, compileQuery, defineEntity, useCollectionQuery, useEntityCollection } from "@/components/entity-view"

interface Terminal {
    id: number
    name: string
    branch: string
    sales: number
}

// No `orderBy`: the list loads every row and sorts in the browser.
const terminalEntity = defineEntity<Terminal>()((f) => ({
    title: "Terminales",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        branch: f.text("branch", { label: "Sucursal" }),
        sales: f.number("sales", { label: "Ventas" }),
    },
    query: {
        search: { placeholder: "Buscar terminales…" },
        sort: { fields: ["name", "sales"], default: "name" },
    },
}))
const terminalViews = terminalEntity.views({ table: { columns: ["name", "branch", "sales"] } })

const rows: Terminal[] = [
    { id: 1, name: "Caja B", branch: "Centro", sales: 30 },
    { id: 2, name: "Caja A", branch: "Norte", sales: 30 },
    { id: 3, name: "Caja C", branch: "Centro", sales: 10 },
]

function Screen() {
    const query = useCollectionQuery(terminalEntity, { sorting: "client" })
    const collection = useEntityCollection(terminalEntity, { rows }, { pagination: { mode: "none" }, sorting: query.sorting })
    return (
        <Collection.Root collection={collection} query={query}>
            <Collection.Toolbar />
            <Collection.View table={terminalViews.table} />
            <output aria-label="Parámetros">{Object.keys(query.params).join(",")}</output>
        </Collection.Root>
    )
}

function setup(search = "") {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    render(
        <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
            <Screen />
        </NuqsTestingAdapter>,
    )
    const url = () => onUrlUpdate.mock.lastCall?.[0].searchParams ?? new URLSearchParams(search)
    return { user: userEvent.setup(), url }
}

const names = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? "")

interface Contract {
    id: number
    name: string
    start_date: string
    end_date: string
}

/** A date filter with two server params (budgets' `period`), i.e. not the filter id itself. */
const contractEntity = defineEntity<Contract>()((f) => ({
    title: "Contratos",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        period: f.dateRange((c) => ({ from: c.start_date, to: c.end_date }), { label: "Periodo" }),
    },
    query: {
        filters: {
            period: {
                field: "period",
                control: "date",
                paramFrom: "start_date__gte",
                paramTo: "end_date__lte",
            },
        },
    },
}))

function dateFilterHarness(search = "") {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>{children}</NuqsTestingAdapter>
    )
    const hook = renderHook(() => useCollectionQuery(contractEntity), { wrapper })
    const url = () => onUrlUpdate.mock.lastCall?.[0].queryString ?? ""
    return { ...hook, url }
}

describe("useCollectionQuery with a two-param date filter", () => {
    it("exposes paramFrom/paramTo in params, never the filter id", async () => {
        const { result, url } = dateFilterHarness("?start_date__gte=2026-01-01&end_date__lte=2026-12-31")
        expect(result.current.params).toEqual({
            start_date__gte: "2026-01-01",
            end_date__lte: "2026-12-31",
        })
        expect(Object.keys(result.current.params)).not.toContain("period")

        act(() => void result.current.search.applyFilter("start_date__gte", "2026-06-01"))
        act(() => void result.current.search.applyFilter("end_date__lte", "2027-05-31"))
        await waitFor(() => expect(url()).toContain("start_date__gte=2026-06-01"))
        expect(url()).toContain("end_date__lte=2027-05-31")
        expect(url()).not.toContain("period=")
        expect(result.current.params).toEqual({
            start_date__gte: "2026-06-01",
            end_date__lte: "2027-05-31",
        })
    })
})

describe("useCollectionQuery in client mode (ADR-0158 §6)", () => {
    it("compiles sort fields without a server key", () => {
        expect(compileQuery(terminalEntity, { sorting: "client" }).sortFields).toEqual([
            { id: "name", label: "Nombre", orderBy: null },
            { id: "sales", label: "Ventas", orderBy: null },
        ])
        expect(() => compileQuery(terminalEntity)).toThrow(/orderBy/)
    })

    it("sorts the loaded rows by the default key and sends no ordering", () => {
        setup()
        expect(names()).toEqual(["Caja A", "Caja B", "Caja C"])
        expect(screen.getByRole("status", { name: "Parámetros" })).not.toHaveTextContent("ordering")
    })

    it("sorts by every key in ?ordering=, in order", () => {
        setup("ordering=-sales,-name")
        expect(names()).toEqual(["Caja B", "Caja A", "Caja C"])
    })

    it("a header click replaces the first key and only the first key marks its header; undeclared columns do not sort", async () => {
        const { user, url } = setup("ordering=name,-sales")
        // Secondary keys do not mark their header: one aria-sort per table.
        expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute("aria-sort", "ascending")
        expect(screen.getByRole("columnheader", { name: /Ventas/ })).not.toHaveAttribute("aria-sort")
        await user.click(within(screen.getByRole("columnheader", { name: /Ventas/ })).getByRole("button"))
        // Ventas replaces the first key (its first direction is TanStack's, by data type) and the rows follow.
        await waitFor(() => expect(url().get("ordering")).toMatch(/^-?sales$/))
        expect(names()[0]).toBe(url().get("ordering")?.startsWith("-") ? "Caja B" : "Caja C")
        expect(within(screen.getByRole("columnheader", { name: /Sucursal/ })).queryByRole("button")).toBeNull()
    })
})
