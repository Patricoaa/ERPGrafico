import { describe, expect, it, vi } from "vitest"
import { render, screen, within, waitFor, renderHook } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { Collection, compileQuery, defineEntity, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { useFacetCounts } from "@/hooks/useFacetCounts"
import { facetRequestParams, toFacetCounts, type FacetCounts } from "@/lib/facets"

interface Order {
    id: number
    number: string
    delivery: string
}

const entity = defineEntity<Order>()((f) => ({
    title: "Órdenes",
    fields: {
        number: f.code("number", { label: "Folio", orderBy: "number" }),
        delivery: f.text("delivery", { label: "Despacho" }),
    },
    query: {
        filters: {
            delivery_status: { label: "Despacho", control: "multi", counts: true, options: [{ value: "PENDING", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "DELIVERED", label: "Entregado" }] },
            origin: { label: "Origen", control: "multi", param: "origin_status", options: [{ value: "DRAFT", label: "Borrador" }] },
        },
        sort: { fields: ["number"], default: "-number" },
        views: [
            { id: "all", label: "Todas", count: true },
            { id: "pending", label: "Pendientes", filters: { delivery_status: ["PENDING", "PARTIAL"] }, count: true },
            { id: "drafts", label: "Borradores", filters: { origin: "DRAFT" } },
        ],
    },
}))
const views = entity.views({ table: { columns: ["number", "delivery"] } })

function Screen({ facets }: { facets: FacetCounts | null }) {
    const query = useCollectionQuery(entity)
    const collection = useEntityCollection(entity, { rows: [], rowCount: 0 }, { pagination: { mode: "none" }, sorting: query.sorting })
    return (
        <Collection.Root collection={collection} query={{ ...query, facets }} label="Órdenes">
            <Collection.Toolbar />
            <Collection.View table={views.table} />
        </Collection.Root>
    )
}

function setup(facets: FacetCounts | null, search = "") {
    render(
        <NuqsTestingAdapter searchParams={search} hasMemory>
            <Screen facets={facets} />
        </NuqsTestingAdapter>,
    )
    return userEvent.setup()
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(screen.getByRole("toolbar")).getByRole("button", { name: /^Filtros/ }))
}

describe("facet counts (ADR-0158 §8)", () => {
    it("compiles the params of the filters with counts", () => {
        expect(compileQuery(entity).facetParams).toEqual(["delivery_status"])
    })

    it("shows the total of the views that count", () => {
        setup({ fields: {}, views: { all: 9, pending: 1 } })
        expect(screen.getByRole("tab", { name: "Todas, 9 resultados" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Pendientes, 1 resultado" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Borradores" })).toBeInTheDocument()
    })

    it("shows each option's count and disables the ones with none left", async () => {
        const user = setup({ fields: { delivery_status: { PENDING: 4, DELIVERED: 1 } }, views: {} })
        await openFilters(user)
        expect(screen.getByRole("checkbox", { name: /Pendiente.*4 resultados/ })).toBeEnabled()
        expect(screen.getByRole("checkbox", { name: /Entregado.*1 resultado$/ })).toBeEnabled()
        expect(screen.getByRole("checkbox", { name: /Parcial.*0 resultados/ })).toBeDisabled()
    })

    it("keeps a chosen option enabled even when its count is 0", async () => {
        const user = setup({ fields: { delivery_status: { PENDING: 4 } }, views: {} }, "?delivery_status=PARTIAL")
        await openFilters(user)
        expect(screen.getByRole("checkbox", { name: /Parcial/ })).toBeEnabled()
    })

    it("shows plain options while there are no counts", async () => {
        const user = setup(null)
        await openFilters(user)
        expect(screen.getByRole("checkbox", { name: "Pendiente" })).toBeEnabled()
    })
})

describe("facet request", () => {
    it("derives the params of the counted views, not of the user's filters", () => {
        const { result } = renderHook(() => useCollectionQuery(entity), {
            wrapper: ({ children }: { children: ReactNode }) => <NuqsTestingAdapter searchParams="?origin_status=DRAFT">{children}</NuqsTestingAdapter>,
        })
        expect(result.current.facetViews).toEqual({ all: {}, pending: { delivery_status: "PENDING,PARTIAL" } })
    })

    it("sends the views as JSON with their own params, and the fields", () => {
        const compiled = compileQuery(entity)
        expect(compiled.facetParams).toEqual(["delivery_status"])
        const params = facetRequestParams(new URLSearchParams("search=x"), ["delivery_status"], { pending: { delivery_status: "PENDING,PARTIAL" } })
        expect(params.get("fields")).toBe("delivery_status")
        expect(JSON.parse(params.get("views") ?? "")).toEqual({ pending: { delivery_status: "PENDING,PARTIAL" } })
        expect(params.get("search")).toBe("x")
    })
})

describe("useFacetCounts", () => {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
    }

    it("asks for the fields with the list params, without the ordering", async () => {
        const fetchFacets = vi.fn(async () => toFacetCounts({ fields: { delivery_status: [{ value: "PENDING", count: 2 }] }, views: { all: 5 } }))
        const views = { all: {} }
        const { result } = renderHook(
            () => useFacetCounts({ fields: ["delivery_status"], views, params: { search: "x", ordering: "-date" }, queryKey: ["t"], fetchFacets }),
            { wrapper },
        )
        await waitFor(() => expect(result.current).toEqual({ fields: { delivery_status: { PENDING: 2 } }, views: { all: 5 } }))
        expect(fetchFacets).toHaveBeenCalledWith({ search: "x" }, ["delivery_status"], views)
    })

    it("does not ask when no filter wants counts", () => {
        const fetchFacets = vi.fn(async () => ({ fields: {}, views: {} }))
        const { result } = renderHook(() => useFacetCounts({ fields: [], views: {}, params: {}, queryKey: ["t"], fetchFacets }), { wrapper })
        expect(result.current).toBeNull()
        expect(fetchFacets).not.toHaveBeenCalled()
    })
})
