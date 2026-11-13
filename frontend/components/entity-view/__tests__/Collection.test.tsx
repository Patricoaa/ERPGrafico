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
import { EmbeddedSurfaceProvider, Section } from "@/components/shared"
import type { CollectionOptions, CollectionSurfaceOptions } from "@/components/entity-view"

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

// Dry-run warnings and simulation previews are built from API results, not table records: they have
// neither `id` nor `rowId`, so before the index fallback every row shared the "" key.
interface PreviewRow { label: string }

const previewEntity = defineEntity<PreviewRow>()((f) => ({
    title: "Advertencias de importación",
    fields: { label: f.text("label", { label: "Mensaje" }) },
}))
const previewViews = previewEntity.views({ table: { columns: ["label"] } })

function DerivedRowsHarness() {
    const collection = useEntityCollection(
        previewEntity,
        { rows: [{ label: "Uno" }, { label: "Dos" }] },
        { pagination: { mode: "none" } },
    )
    return (
        <>
            <output data-testid="ids">{collection.table.getRowModel().rows.map((r) => r.id).join(",")}</output>
            <Collection.Root collection={collection} label="Advertencias de importación">
                <Collection.View table={previewViews.table} />
            </Collection.Root>
        </>
    )
}

describe("Derived rows without identity", () => {
    it("falls back to the row index so keys stay unique", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        try {
            render(<DerivedRowsHarness />)
            expect(screen.getByTestId("ids").textContent).toBe("row-0,row-1")
            expect(screen.getByText("Dos")).toBeInTheDocument()
            expect(error.mock.calls.flat().join(" ")).not.toMatch(/same key/i)
        } finally {
            error.mockRestore()
        }
    })
})

// ─── Embedded variant (ADR-0137) ─────────────────────────────────────────────

const manyRows: Uom[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Unidad ${i + 1}`, abbreviation: `u${i + 1}`, ratio: "1" }))

function EmbeddedHarness({
    rows: data,
    options,
    surface,
    inOverlay = false,
    isFiltered,
}: {
    rows: Uom[]
    options?: CollectionOptions<"name" | "abbreviation" | "ratio">
    surface?: CollectionSurfaceOptions
    inOverlay?: boolean
    isFiltered?: boolean
}) {
    const collection = useEntityCollection(entity, { rows: data, isFiltered }, options)
    const body = (
        <Collection.Root collection={collection} label="Unidades de medida">
            <Collection.View table={views.table} emptyTitle="Sin unidades" {...surface} />
        </Collection.Root>
    )
    return inOverlay ? <EmbeddedSurfaceProvider>{body}</EmbeddedSurfaceProvider> : body
}

const frameOf = () => screen.getByRole("table").parentElement?.parentElement as HTMLElement

describe("Collection embedded variant", () => {
    it("keeps the frame outside an overlay and drops it inside one", () => {
        const { unmount } = render(<EmbeddedHarness rows={rows} />)
        expect(frameOf().className).toContain("border")
        unmount()
        render(<EmbeddedHarness rows={rows} inOverlay />)
        expect(frameOf().className).not.toContain("border")
    })

    it("lets frame be forced either way", () => {
        render(<EmbeddedHarness rows={rows} inOverlay surface={{ frame: "card" }} />)
        expect(frameOf().className).toContain("border")
    })

    it("renders the empty state as bare columns inside an overlay", () => {
        render(<EmbeddedHarness rows={[]} inOverlay />)
        expect(screen.queryByText("Sin unidades")).not.toBeInTheDocument()
        const table = screen.getByRole("table")
        expect(within(table).getAllByRole("columnheader")).toHaveLength(3)
        expect(within(table).getByText("Sin registros")).toBeInTheDocument()
    })

    it("keeps the empty message outside an overlay, when filtered, and when there is an action", () => {
        const { unmount } = render(<EmbeddedHarness rows={[]} />)
        expect(screen.getByText("Sin unidades")).toBeInTheDocument()
        unmount()
        const filtered = render(<EmbeddedHarness rows={[]} inOverlay isFiltered />)
        expect(screen.getByText("Ningún resultado para el filtro")).toBeInTheDocument()
        filtered.unmount()
        render(<EmbeddedHarness rows={[]} inOverlay surface={{ empty: "message" }} />)
        expect(screen.getByText("Sin unidades")).toBeInTheDocument()
    })

    it("pages with Mostrar más inside an overlay and reveals step rows per click", async () => {
        const user = userEvent.setup()
        render(<EmbeddedHarness rows={manyRows} inOverlay options={{ pagination: { mode: "more", step: 10 } }} />)
        const shown = () => screen.getAllByText(/^Unidad \d+$/).length
        expect(shown()).toBe(10)
        await user.click(screen.getByRole("button", { name: "Mostrar más (15 restantes)" }))
        expect(shown()).toBe(20)
        await user.click(screen.getByRole("button", { name: "Mostrar más (5 restantes)" }))
        expect(shown()).toBe(25)
        expect(screen.queryByRole("button", { name: /Mostrar más/ })).not.toBeInTheDocument()
    })

    it("turns default client pagination into Mostrar más only when embedded", () => {
        const { unmount } = render(<EmbeddedHarness rows={manyRows} inOverlay />)
        expect(screen.getByRole("button", { name: "Mostrar más (5 restantes)" })).toBeInTheDocument()
        unmount()
        render(<EmbeddedHarness rows={manyRows} />)
        expect(screen.queryByRole("button", { name: /Mostrar más/ })).not.toBeInTheDocument()
    })

    it("caps the height with maxHeight", () => {
        render(<EmbeddedHarness rows={rows} surface={{ maxHeight: 240 }} />)
        expect(frameOf().style.maxHeight).toBe("240px")
    })
})

describe("Embedded header and record count", () => {
    it("drops the sticky header background only when embedded", () => {
        const { unmount } = render(<EmbeddedHarness rows={rows} />)
        expect(screen.getAllByRole("rowgroup")[0].className).toContain("bg-background")
        unmount()
        render(<EmbeddedHarness rows={rows} inOverlay />)
        expect(screen.getAllByRole("rowgroup")[0].className).not.toContain("bg-background")
    })

    it("shows the collection total in a sibling Section.Header inside Section.Scope", () => {
        function Scoped({ data, count }: { data: Uom[]; count?: string }) {
            const collection = useEntityCollection(entity, { rows: data })
            return (
                <Section.Scope>
                    <Section.Header title="Unidades" count={count} />
                    <Collection.Root collection={collection} label="Unidades de medida">
                        <Collection.View table={views.table} />
                    </Collection.Root>
                </Section.Scope>
            )
        }
        const first = render(<Scoped data={manyRows} />)
        expect(screen.getByText("25 registros")).toBeInTheDocument()
        first.unmount()
        const second = render(<Scoped data={rows.slice(0, 1)} />)
        expect(screen.getByText("1 registro")).toBeInTheDocument()
        second.unmount()
        render(<Scoped data={rows} count="manual" />)
        expect(screen.getByText("manual")).toBeInTheDocument()
        expect(screen.queryByText("2 registros")).not.toBeInTheDocument()
    })
})
