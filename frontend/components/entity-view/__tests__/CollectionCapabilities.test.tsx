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

describe("default sorting with server pagination (lote 2b)", () => {
    it("never reorders a single server page: without `sorting`, no header is sortable", () => {
        const server = { mode: "server" as const, state: { pageIndex: 0, pageSize: 2 }, onChange: vi.fn() }
        render(<Harness source={{ rows: rows.slice(0, 2), rowCount: 3 }} options={{ pagination: server }} />)
        expect(screen.getAllByRole("columnheader").flatMap((h) => within(h).queryAllByRole("button"))).toHaveLength(0)
    })
})

describe("client pagination with rows filtered in render (code review, oleada A1)", () => {
    const many: Item[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Artículo ${String(i + 1).padStart(2, "0")}`, category: "Papeles", stock: i }))

    function Filtered({ list }: { list: Item[] }) {
        // A new array on every render of the component that owns the hook, like `search.filterFn(rows)` in the views.
        const collection = useEntityCollection(entity, { rows: list.filter(() => true) }, { pagination: { mode: "client", pageSize: 20 } })
        return (
            <Collection.Root collection={collection}>
                <Collection.View table={views.table} card={views.card} />
            </Collection.Root>
        )
    }

    it("moves to the next page without looping on the new rows array", async () => {
        render(<Filtered list={many} />)
        await userEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }))
        expect(screen.getByText("Artículo 21")).toBeInTheDocument()
    })

    it("clamps to the last existing page when a filter shrinks the list", async () => {
        const { rerender } = render(<Filtered list={many} />)
        await userEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }))
        rerender(<Filtered list={many.slice(0, 5)} />)
        expect(screen.getByText("Artículo 01")).toBeInTheDocument()
    })
})

describe("failed background refetch (code review, oleada A1)", () => {
    it("keeps showing the cached rows instead of the error state", () => {
        render(<Harness source={{ rows, error: true }} options={{ pagination: { mode: "none" } }} />)
        expect(screen.getByText("Papel couché")).toBeInTheDocument()
        expect(screen.queryByText(/No pudimos cargar/)).not.toBeInTheDocument()
    })

    it("shows the error state when there are no rows", () => {
        render(<Harness source={{ rows: [], error: true }} options={{ pagination: { mode: "none" } }} />)
        expect(screen.getByText(/No pudimos cargar/)).toBeInTheDocument()
    })
})

describe("hierarchical rows (tree)", () => {
    interface Account {
        id: number
        code: string
        name: string
        children?: Account[]
    }
    const accounts: Account[] = [
        { id: 1, code: "1", name: "Activo", children: [
            { id: 11, code: "1.1", name: "Caja", children: [{ id: 111, code: "1.1.1", name: "Caja chica" }] },
            { id: 12, code: "1.2", name: "Bancos" },
        ] },
        { id: 2, code: "2", name: "Pasivo" },
    ]
    const build = (defaultExpanded?: boolean) =>
        defineEntity<Account>()((f) => ({
            title: "Cuentas",
            tree: { children: (a) => a.children, defaultExpanded },
            fields: { code: f.code("code", { label: "Código" }), name: f.text("name", { label: "Nombre" }) },
        }))
    const treeEntity = build()
    const treeViews = treeEntity.views({ table: { columns: ["code", "name"] } })

    function Tree({ entityDef = treeEntity, pageSize, onOpen }: { entityDef?: typeof treeEntity; pageSize?: number; onOpen?: (a: Account) => void }) {
        const collection = useEntityCollection(entityDef, { rows: accounts }, { pagination: pageSize ? { mode: "client", pageSize } : { mode: "none" } })
        return (
            <Collection.Root collection={collection} onOpen={onOpen}>
                <Collection.View table={treeViews.table} />
            </Collection.Root>
        )
    }

    it("starts with every branch open, children under their parent", () => {
        render(<Tree />)
        const names = screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1].textContent)
        expect(names).toEqual(["Activo", "Caja", "Caja chica", "Bancos", "Pasivo"])
    })

    it("folds a branch from its toggle without opening the row", async () => {
        const onOpen = vi.fn()
        render(<Tree onOpen={onOpen} />)
        await userEvent.click(screen.getByRole("button", { name: "Contraer 1.1" }))
        expect(screen.queryByText("Caja chica")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Expandir 1.1" })).toHaveAttribute("aria-expanded", "false")
        expect(onOpen).not.toHaveBeenCalled()
    })

    it("collapses and expands every branch from the header", async () => {
        render(<Tree />)
        await userEvent.click(screen.getByRole("button", { name: "Contraer todo" }))
        expect(screen.queryByText("Caja")).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Expandir todo" }))
        expect(screen.getByText("Caja chica")).toBeInTheDocument()
    })

    it("can start folded", () => {
        render(<Tree entityDef={build(false)} />)
        expect(screen.getByText("Activo")).toBeInTheDocument()
        expect(screen.queryByText("Caja")).not.toBeInTheDocument()
    })

    it("the header control reads 'Contraer todo' again once every branch is reopened by hand", async () => {
        render(<Tree />)
        await userEvent.click(screen.getByRole("button", { name: "Contraer todo" }))
        await userEvent.click(screen.getByRole("button", { name: "Expandir 1" }))
        await userEvent.click(screen.getByRole("button", { name: "Expandir 1.1" }))
        expect(screen.getByRole("button", { name: "Contraer todo" })).toBeInTheDocument()
    })

    it("sums roots only in the footer, whatever is folded", async () => {
        interface Line { id: number; name: string; amount: number; children?: Line[] }
        const lines: Line[] = [{ id: 1, name: "Activo", amount: 100, children: [{ id: 2, name: "Caja", amount: 60 }, { id: 3, name: "Bancos", amount: 40 }] }]
        const lineEntity = defineEntity<Line>()((f) => ({
            title: "Saldos",
            tree: { children: (l) => l.children },
            fields: { name: f.text("name", { label: "Cuenta" }), amount: f.number("amount", { label: "Monto" }) },
        }))
        const lineViews = lineEntity.views({ table: { columns: ["name", "amount"], footer: { sum: ["amount"] } } })
        function Sums() {
            const collection = useEntityCollection(lineEntity, { rows: lines }, { pagination: { mode: "none" } })
            return (
                <Collection.Root collection={collection}>
                    <Collection.View table={lineViews.table} />
                </Collection.Root>
            )
        }
        const { container } = render(<Sums />)
        expect(container.querySelector("tfoot")?.textContent).toContain("100")
        expect(container.querySelector("tfoot")?.textContent).not.toContain("200")
        await userEvent.click(screen.getByRole("button", { name: "Contraer todo" }))
        expect(container.querySelector("tfoot")?.textContent).toContain("100")
    })

    it("bulk selection: a child reaches the bulk actions, a parent does not drag its subtree", async () => {
        const onRun = vi.fn<(selected: Account[]) => void>()
        function Bulk() {
            const collection = useEntityCollection(treeEntity, { rows: accounts }, { pagination: { mode: "none" } })
            return (
                <Collection.Root collection={collection} selection="bulk">
                    <Collection.View table={treeViews.table} />
                    <Collection.BulkBar actions={[{ key: "run", label: "Ejecutar", onClick: onRun }]} />
                </Collection.Root>
            )
        }
        render(<Bulk />)
        const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement
        await userEvent.click(within(rowOf("Caja chica")).getByRole("checkbox"))
        await userEvent.click(within(rowOf("Activo")).getByRole("checkbox"))
        expect(within(rowOf("Caja")).getByRole("checkbox")).not.toBeChecked()
        await userEvent.click(screen.getByRole("button", { name: /Ejecutar/ }))
        expect(onRun.mock.calls[0][0].map((a: Account) => a.name).sort()).toEqual(["Activo", "Caja chica"])
    })

    it("paginates whole branches: children stay on their parent's page", () => {
        render(<Tree pageSize={1} />)
        expect(screen.getByText("Caja chica")).toBeInTheDocument()
        expect(screen.queryByText("Pasivo")).not.toBeInTheDocument()
    })
})
