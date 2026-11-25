import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Collection, defineEntity, useEntityCollection } from "@/components/entity-view"
import type { ServerGroupState } from "@/lib/server-groups"

interface Order {
    id: number
    folio: string
    date: string
    total: string
}

const entity = defineEntity<Order>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code("folio", { label: "Folio" }),
        date: f.date("date", { label: "Fecha", groupKey: "date" }),
        total: f.money("total", { label: "Total" }),
    },
}))
const views = entity.views({ table: { columns: ["folio", "date", "total"] } })

function group(overrides: Partial<ServerGroupState<Order>> & Pick<ServerGroupState<Order>, "key">): ServerGroupState<Order> {
    return {
        id: overrides.key ?? "∅",
        label: null,
        count: 0,
        aggregates: {},
        params: overrides.key ? { date: overrides.key } : null,
        open: false,
        rows: [],
        isLoading: false,
        isError: false,
        hasMore: false,
        toggle: vi.fn(),
        showMore: vi.fn(),
        ...overrides,
    }
}

function Harness({ groups }: { groups: ServerGroupState<Order>[] }) {
    const collection = useEntityCollection(entity, { rows: [] }, { pagination: { mode: "none" }, groupBy: "date", serverGroups: groups })
    return (
        <Collection.Root collection={collection} label="Órdenes">
            <Collection.View table={views.table} />
        </Collection.Root>
    )
}

const open = group({
    key: "2026-11-03",
    count: 5,
    aggregates: { total: "150" },
    open: true,
    rows: [
        { id: 1, folio: "OV-1", date: "2026-11-03", total: "100" },
        { id: 2, folio: "OV-2", date: "2026-11-03", total: "50" },
    ],
    hasMore: true,
})
const closed = group({ key: "2026-11-02", count: 7, aggregates: { total: "900" } })
const noValue = group({ key: null, count: 1 })

describe("Collection with server groups (ADR-0158 §7)", () => {
    it("shows every group with the whole-result count and subtotal, and only the open groups' rows", () => {
        render(<Harness groups={[open, closed, noValue]} />)
        const table = screen.getByRole("table")
        const headers = within(table).getAllByRole("rowheader")
        expect(headers).toHaveLength(3)
        expect(headers[0]).toHaveTextContent("(5)")
        expect(headers[0]).toHaveTextContent("$150")
        expect(headers[1]).toHaveTextContent("(7)")
        expect(headers[2]).toHaveTextContent("Sin fecha (1)")
        expect(within(table).getByText("OV-1")).toBeInTheDocument()
        expect(within(table).getByText("OV-2")).toBeInTheDocument()
    })

    it("formats a date key as a date, not the raw ISO text", () => {
        render(<Harness groups={[closed]} />)
        expect(screen.queryByText(/2026-11-02/)).not.toBeInTheDocument()
    })

    it("folds and unfolds a group through its toggle", async () => {
        const user = userEvent.setup()
        render(<Harness groups={[open, closed]} />)
        const [openToggle, closedToggle] = screen.getAllByRole("button", { expanded: undefined }).filter((b) => b.hasAttribute("aria-expanded"))
        expect(openToggle).toHaveAttribute("aria-expanded", "true")
        expect(closedToggle).toHaveAttribute("aria-expanded", "false")
        await user.click(closedToggle)
        expect(closed.toggle).toHaveBeenCalledTimes(1)
    })

    it("offers «Mostrar más» with the loaded / total rows", async () => {
        const user = userEvent.setup()
        render(<Harness groups={[open]} />)
        await user.click(screen.getByRole("button", { name: "Mostrar más (2 de 5)" }))
        expect(open.showMore).toHaveBeenCalledTimes(1)
    })

    it("a group without row params cannot fold open", () => {
        render(<Harness groups={[noValue]} />)
        expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument()
    })

    it("does not warn about truncation: the groups cover the whole result", () => {
        render(<Harness groups={[open, closed]} />)
        expect(screen.queryByText(/Agrupando los primeros/)).not.toBeInTheDocument()
    })
})
