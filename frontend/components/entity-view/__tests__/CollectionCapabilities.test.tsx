import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button } from "@/components/ui/button"
import {
    Collection,
    defineEntity,
    orderingParam,
    useEntityCollection,
    type CollectionOptions,
    type CollectionSource,
    type CollectionViewProps,
    type FieldId,
    type SortSpec,
} from "@/components/entity-view"

interface Item {
    id: number
    name: string
    category: string
    stock: number
}

const entity = defineEntity<Item>()((f) => ({
    title: "Artículos",
    fields: {
        name: f.text("name", { label: "Nombre", orderBy: "name" }),
        category: f.text("category", { label: "Categoría" }),
        stock: f.number("stock", { label: "Stock", orderBy: "current_stock" }),
    },
}))
type Id = FieldId<typeof entity.fields>

const views = entity.views({
    table: { columns: ["name", "category", "stock"] },
    card: { title: "name", subtitle: ["category"] },
})

const rows: Item[] = [
    { id: 1, name: "Papel couché", category: "Papeles", stock: 10 },
    { id: 2, name: "Tinta cyan", category: "Tintas", stock: 4 },
    { id: 3, name: "Papel bond", category: "Papeles", stock: 7 },
]

function Harness({
    source,
    options,
    children,
    view,
}: {
    source: CollectionSource<Item>
    options?: CollectionOptions<Id>
    children?: React.ReactNode
    view?: Partial<CollectionViewProps<Item, Id>>
}) {
    const collection = useEntityCollection(entity, source, options)
    return (
        <Collection.Root collection={collection} selection="bulk">
            <Collection.Toolbar />
            <Collection.View table={views.table} card={views.card} {...view} />
            {children}
        </Collection.Root>
    )
}

describe("orderingParam (server sorting, Gate D lote 2)", () => {
    it("maps a field id to its server key with a stable id tie-break", () => {
        expect(orderingParam(entity, "stock")).toBe("current_stock,id")
        expect(orderingParam(entity, "-name")).toBe("-name,-id")
    })

    it("returns undefined without a spec or for fields without orderBy", () => {
        expect(orderingParam(entity, null)).toBeUndefined()
        expect(orderingParam(entity, "category")).toBeUndefined()
    })
})

describe("server sorting", () => {
    it("only fields with orderBy are sortable, and sorting notifies the spec instead of reordering", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn<(next: SortSpec<Id> | null) => void>()
        render(<Harness source={{ rows }} options={{ sorting: { mode: "server", state: null, onChange }, pagination: { mode: "none" } }} />)
        const table = screen.getByRole("table")
        expect(within(screen.getByRole("columnheader", { name: /Categoría/ })).queryByRole("button")).toBeNull()
        await user.click(within(screen.getByRole("columnheader", { name: /Stock/ })).getByRole("button"))
        // Numeric columns sort descending first (TanStack default, same as local sorting).
        expect(onChange).toHaveBeenCalledWith("-stock")
        // Rows keep the server order: no local reordering.
        const firstCells = within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1]?.textContent)
        expect(firstCells).toEqual(["Papel couché", "Tinta cyan", "Papel bond"])
    })

    it("reflects the controlled spec in aria-sort", () => {
        render(<Harness source={{ rows }} options={{ sorting: { mode: "server", state: "-stock", onChange: vi.fn() }, pagination: { mode: "none" } }} />)
        expect(screen.getByRole("columnheader", { name: /Stock/ })).toHaveAttribute("aria-sort", "descending")
    })
})

describe("grouping", () => {
    it("renders one row group per formatted value, with its count", () => {
        render(<Harness source={{ rows }} options={{ groupBy: "category", pagination: { mode: "none" } }} />)
        const groups = screen.getAllByRole("rowheader")
        expect(groups.map((g) => g.textContent)).toEqual(["Papeles (2)", "Tintas (1)"])
    })

    it("warns when grouping shows fewer rows than the server total", () => {
        render(<Harness source={{ rows, rowCount: 420 }} options={{ groupBy: "category", pagination: { mode: "none" } }} />)
        expect(screen.getByRole("status")).toHaveTextContent("Agrupando los primeros 3 de 420 resultados")
    })

    it("does not warn when every row is loaded", () => {
        render(<Harness source={{ rows, rowCount: 3 }} options={{ groupBy: "category", pagination: { mode: "none" } }} />)
        expect(screen.queryByRole("status")).toBeNull()
    })
})

describe("Collection.BulkBar", () => {
    it("appears with the selection and runs the action with the selected rows", async () => {
        const user = userEvent.setup()
        const onClick = vi.fn()
        render(
            <Harness source={{ rows }} options={{ pagination: { mode: "none" } }}>
                <Collection.BulkBar actions={[{ key: "archive", label: "Archivar", onClick }]} />
            </Harness>,
        )
        expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull()
        const boxes = screen.getAllByRole("checkbox", { name: "Seleccionar fila" })
        await user.click(boxes[0])
        await user.click(boxes[2])
        expect(screen.getByText("2 seleccionados")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Archivar" }))
        expect(onClick).toHaveBeenCalledWith([rows[0], rows[2]])
    })
})

describe("Collection.Analytics", () => {
    it("adds an analytics view that replaces the table while active", async () => {
        const user = userEvent.setup()
        render(
            <Harness source={{ rows }} options={{ pagination: { mode: "none" } }}>
                <Collection.Analytics>
                    <p>Panel de analítica</p>
                </Collection.Analytics>
            </Harness>,
        )
        expect(screen.queryByText("Panel de analítica")).toBeNull()
        await user.click(screen.getByRole("button", { name: "Analítica" }))
        expect(screen.getByText("Panel de analítica")).toBeInTheDocument()
        expect(screen.queryByRole("table")).toBeNull()
    })

    it("offers no analytics view without Collection.Analytics", () => {
        render(<Harness source={{ rows }} />)
        expect(screen.queryByRole("button", { name: "Analítica" })).toBeNull()
    })
})

describe("empty states", () => {
    it("offers the create action when truly empty", () => {
        render(<Harness source={{ rows: [] }} view={{ emptyAction: <Button type="button">Nueva unidad</Button> }} />)
        expect(screen.getByRole("button", { name: "Nueva unidad" })).toBeInTheDocument()
    })

    it("offers to clear filters when the empty result comes from a filter", async () => {
        const user = userEvent.setup()
        const onResetFilters = vi.fn()
        render(<Harness source={{ rows: [], isFiltered: true }} view={{ onResetFilters }} />)
        await user.click(screen.getByRole("button", { name: "Limpiar filtros" }))
        expect(onResetFilters).toHaveBeenCalledOnce()
    })
})

describe("selection with fresh data (code review, lote 2a)", () => {
    it("bulk actions receive the refetched rows, not the objects that were selected", async () => {
        const user = userEvent.setup()
        const onClick = vi.fn()
        const bulk = <Collection.BulkBar actions={[{ key: "archive", label: "Archivar", onClick }]} />
        const { rerender } = render(<Harness source={{ rows }} options={{ pagination: { mode: "none" } }}>{bulk}</Harness>)
        await user.click(screen.getAllByRole("checkbox", { name: "Seleccionar fila" })[0])
        const refetched = rows.map((row) => ({ ...row, stock: row.stock + 100 }))
        rerender(<Harness source={{ rows: refetched }} options={{ pagination: { mode: "none" } }}>{bulk}</Harness>)
        await user.click(screen.getByRole("button", { name: "Archivar" }))
        expect(onClick).toHaveBeenCalledWith([refetched[0]])
    })

    it("server pagination clears the selection when another page of rows arrives", async () => {
        const user = userEvent.setup()
        const server = { mode: "server" as const, state: { pageIndex: 0, pageSize: 2 }, onChange: vi.fn() }
        const { rerender } = render(<Harness source={{ rows: rows.slice(0, 2), rowCount: 3 }} options={{ pagination: server }}><Collection.BulkBar actions={[]} /></Harness>)
        await user.click(screen.getAllByRole("checkbox", { name: "Seleccionar fila" })[0])
        expect(screen.getByText("1 seleccionado")).toBeInTheDocument()
        rerender(<Harness source={{ rows: rows.slice(2), rowCount: 3 }} options={{ pagination: { ...server, state: { pageIndex: 1, pageSize: 2 } } }}><Collection.BulkBar actions={[]} /></Harness>)
        expect(screen.queryByText(/seleccionado/)).toBeNull()
    })
})
