import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
    Collection,
    EntityViewProvider,
    defineEntity,
    useEntityCollection,
    type CollectionSource,
} from "@/components/entity-view"

interface Uom {
    id: number
    name: string
    abbreviation: string
    ratio: string
}

const entity = defineEntity<Uom>()((f) => ({
    label: "inventory.uom",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        abbreviation: f.code("abbreviation", { label: "Abreviación" }),
        ratio: f.number("ratio", { label: "Ratio", decimals: 2 }),
    },
}))
const views = entity.views({
    table: { columns: ["name", "abbreviation", "ratio"], footer: { sum: ["ratio"] } },
    card: { title: "name", subtitle: ["abbreviation"] },
})

const rows: Uom[] = [
    { id: 1, name: "Kilogramo", abbreviation: "kg", ratio: "1" },
    { id: 2, name: "Gramo", abbreviation: "g", ratio: "0.001" },
]

function Harness({ source, onOpen }: { source: CollectionSource<Uom>; onOpen?: (row: Uom) => void }) {
    const collection = useEntityCollection(entity, source)
    return (
        <Collection.Root collection={collection} onOpen={onOpen} label="Unidades de medida">
            <Collection.Toolbar />
            <Collection.View table={views.table} card={views.card} />
        </Collection.Root>
    )
}

describe("Collection table surface", () => {
    it("renders a single semantic table with column headers (AX-1)", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const tables = screen.getAllByRole("table")
        expect(tables).toHaveLength(1)
        expect(tables[0]).toHaveAccessibleName("Unidades de medida")
        const headers = within(tables[0]).getAllByRole("columnheader")
        expect(headers.map((h) => h.textContent)).toEqual(["Nombre", "Abreviación", "Ratio"])
    })

    it("exposes aria-sort on the sorted column (AX-2)", async () => {
        const user = userEvent.setup()
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const header = screen.getByRole("columnheader", { name: /Nombre/ })
        expect(header).not.toHaveAttribute("aria-sort")
        await user.click(within(header).getByRole("button"))
        expect(header).toHaveAttribute("aria-sort", "ascending")
        const firstCell = screen.getAllByRole("row")[1]
        expect(firstCell).toHaveTextContent("Gramo")
    })

    it("opens a row from the keyboard through the primary cell button (AX-3)", async () => {
        const user = userEvent.setup()
        const onOpen = vi.fn()
        render(<Harness source={{ rows }} onOpen={onOpen} />)
        const open = screen.getByRole("button", { name: "Kilogramo" })
        open.focus()
        await user.keyboard("{Enter}")
        expect(onOpen).toHaveBeenCalledWith(rows[0])
    })

    it("uses the default opener of the provider when no onOpen is given", async () => {
        const user = userEvent.setup()
        const open = vi.fn()
        render(
            <EntityViewProvider opener={{ open, labelOf: () => "Unidades de medida" }}>
                <Harness source={{ rows }} />
            </EntityViewProvider>,
        )
        await user.click(screen.getByRole("button", { name: "Gramo" }))
        expect(open).toHaveBeenCalledWith("inventory.uom", 2, rows[1])
    })

    it("formats the footer total with the kind formatter", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const footer = screen.getAllByRole("rowgroup").at(-1)
        expect(footer).toHaveTextContent("Total")
        expect(footer).toHaveTextContent("1,00")
    })

    it("marks the table busy while loading (AX-5)", () => {
        render(<Harness source={{ rows: undefined, isLoading: true }} />)
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true")
    })

    it("renders empty, filtered-empty and error states with a way out (invariant #8)", async () => {
        const user = userEvent.setup()
        const refetch = vi.fn()
        const { rerender } = render(<Harness source={{ rows: [] }} />)
        expect(screen.queryByRole("table")).toBeNull()
        rerender(<Harness source={{ rows: [], isFiltered: true }} />)
        expect(screen.getByText("Ningún resultado para el filtro")).toBeInTheDocument()
        rerender(<Harness source={{ rows: [], error: new Error("boom"), refetch }} />)
        expect(screen.getByText("No pudimos cargar unidades de medida")).toBeInTheDocument()
        expect(screen.queryByText("boom")).toBeNull()
        await user.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(refetch).toHaveBeenCalledOnce()
    })

    it("switches to the card surface without nested interactive containers (AX-4)", async () => {
        const user = userEvent.setup()
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        await user.click(screen.getByRole("button", { name: "Vista tarjetas" }))
        const list = screen.getByRole("list", { name: "Unidades de medida" })
        expect(within(list).getAllByRole("listitem")).toHaveLength(2)
        expect(list.querySelector('[role="button"] button')).toBeNull()
        expect(within(list).getByRole("button", { name: "Kilogramo" })).toBeInTheDocument()
    })
})
