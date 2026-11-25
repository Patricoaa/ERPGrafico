import { describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useServerGroups } from "@/hooks/useServerGroups"
import type { Page } from "@/lib/pagination"
import type { ServerGroup } from "@/lib/server-groups"

interface Row {
    id: number
}

const groups: ServerGroup[] = ["a", "b", "c", "d"].map((key, i) => ({
    key,
    label: key.toUpperCase(),
    count: 3,
    aggregates: {},
    params: { letter: key },
    ...(i === 3 ? { params: null } : {}),
}))

function page(rows: Row[], hasNextPage: boolean, pageIndex: number): Page<Row> {
    return { results: rows, count: 3, pageSize: 2, pageIndex, hasNextPage } as Page<Row>
}

function setup(groupKey: string | null = "letter", params: Record<string, string> = {}) {
    const fetchGroups = vi.fn(async () => groups)
    const fetchRows = vi.fn(async (p: Record<string, string>, pageNumber: number) =>
        pageNumber === 1 ? page([{ id: 1 }, { id: 2 }], true, 0) : page([{ id: 3 }], false, 1),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const hook = renderHook(
        ({ key, p }: { key: string | null; p: Record<string, string> }) =>
            useServerGroups<Row>({ groupKey: key, params: p, queryKey: ["test"], fetchGroups, fetchRows, pageSize: 2 }),
        { wrapper, initialProps: { key: groupKey, p: params } },
    )
    return { ...hook, fetchGroups, fetchRows }
}

describe("useServerGroups (ADR-0158 §7)", () => {
    it("does nothing without a server group key", () => {
        const { result, fetchGroups } = setup(null)
        expect(result.current.groups).toBeNull()
        expect(fetchGroups).not.toHaveBeenCalled()
    })

    it("asks for the groups with the list params and opens the first three", async () => {
        const { result, fetchGroups, fetchRows } = setup("letter", { search: "x" })
        await waitFor(() => expect(result.current.groups?.[0].rows).toHaveLength(2))
        expect(fetchGroups).toHaveBeenCalledWith({ search: "x", group_by: "letter" })
        expect(result.current.groups?.map((g) => g.open)).toEqual([true, true, true, false])
        // Rows of a group: the list params plus the group's own params.
        expect(fetchRows).toHaveBeenCalledWith({ search: "x", letter: "a" }, 1, 2)
        expect(result.current.groups?.[0].hasMore).toBe(true)
    })

    it("«Mostrar más» loads the next page of that group only", async () => {
        const { result } = setup()
        await waitFor(() => expect(result.current.groups?.[0].rows).toHaveLength(2))
        act(() => result.current.groups?.[0].showMore())
        await waitFor(() => expect(result.current.groups?.[0].rows.map((r) => r.id)).toEqual([1, 2, 3]))
        expect(result.current.groups?.[0].hasMore).toBe(false)
        expect(result.current.groups?.[1].rows).toHaveLength(2)
    })

    it("folds a group and opens a closed one on demand", async () => {
        const { result, fetchRows } = setup()
        await waitFor(() => expect(result.current.groups?.[0].rows).toHaveLength(2))
        act(() => result.current.groups?.[0].toggle())
        expect(result.current.groups?.[0].open).toBe(false)
        expect(fetchRows).not.toHaveBeenCalledWith(expect.objectContaining({ letter: "d" }), 1, 2)
    })

    it("new filters start again from the default open groups", async () => {
        const { result, rerender } = setup("letter", { search: "x" })
        await waitFor(() => expect(result.current.groups?.[0].rows).toHaveLength(2))
        act(() => result.current.groups?.[0].toggle())
        expect(result.current.groups?.[0].open).toBe(false)
        rerender({ key: "letter", p: { search: "y" } })
        await waitFor(() => expect(result.current.groups?.[0].open).toBe(true))
    })
})
