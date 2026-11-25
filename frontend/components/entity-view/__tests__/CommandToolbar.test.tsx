import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { Collection, defineEntity, useCollectionQuery, useEntityCollection } from "@/components/entity-view"

interface Note {
    id: number
    number: string
    customer: string
    status: string
    total: string
}

const noteEntity = defineEntity<Note>()((f) => ({
    title: "Notas de venta",
    fields: {
        number: f.code("number", { label: "Folio", orderBy: "number" }),
        customer: f.text("customer", { label: "Cliente", orderBy: "customer__name" }),
        status: f.text("status", { label: "Estado" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
    },
    query: {
        filters: {
            status: { field: "status", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "CONFIRMED", label: "Confirmada" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
            overdue: { control: "toggle", label: "Solo vencidas" },
        },
        sort: { fields: ["number", "customer", "total"], default: "-number" },
        groupBy: { fields: ["status", "customer"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))
const noteViews = noteEntity.views({ table: { columns: ["number", "customer", "status", "total"] } })

const rows: Note[] = [
    { id: 1, number: "NV-2041", customer: "Viña Los Robles", status: "CONFIRMED", total: "2380000" },
    { id: 2, number: "NV-2037", customer: "Colegio San Andrés", status: "DRAFT", total: "1214400" },
]

function Screen() {
    const query = useCollectionQuery(noteEntity)
    const collection = useEntityCollection(noteEntity, { rows, rowCount: 2 }, { pagination: { mode: "none" }, sorting: query.sorting, groupBy: query.groupBy })
    return (
        <Collection.Root collection={collection} query={query} label="Notas de venta">
            <Collection.Toolbar action={<button type="button">Nueva nota</button>} />
            <Collection.View table={noteViews.table} />
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

const toolbar = () => screen.getByRole("toolbar", { name: "Herramientas de Notas de venta" })

describe("Collection command bar (ADR-0158 stage 3b)", () => {
    it("shows icon + value buttons, naming the tool only in the tooltip and accessible name", () => {
        setup()
        const bar = toolbar()
        expect(within(bar).getByRole("button", { name: "Filtros" })).toHaveAttribute("title", "Filtros")
        const sort = within(bar).getByRole("button", { name: "Ordenar: Folio descendente" })
        expect(sort).toHaveTextContent("Folio ↓")
        expect(sort).not.toHaveTextContent("Ordenar")
        expect(within(bar).getByRole("button", { name: "Agrupar" })).toHaveTextContent("")
        expect(within(bar).getByRole("button", { name: "Nueva nota" })).toBeInTheDocument()
        expect(screen.getByRole("tablist", { name: "Vistas" })).toBeInTheDocument()
    })

    it("applies a multi-select draft with «Aplicar» and shows the chip and the count", async () => {
        const { user, url } = setup()
        await user.click(within(toolbar()).getByRole("button", { name: "Filtros" }))
        await user.click(screen.getByRole("checkbox", { name: "Borrador" }))
        expect(url().get("status")).toBeNull()
        await user.click(screen.getByRole("button", { name: "Aplicar" }))
        await waitFor(() => expect(url().get("status")).toBe("DRAFT"))
        expect(within(toolbar()).getByRole("button", { name: "Filtros: 1 activo" })).toHaveTextContent("1")
        expect(within(screen.getByRole("list", { name: "Filtros aplicados" })).getByText("Estado: Borrador")).toBeInTheDocument()
    })

    it("applies a pending range when the menu closes and discards it on Escape", async () => {
        const { user, url } = setup()
        await user.click(within(toolbar()).getByRole("button", { name: "Filtros" }))
        await user.click(within(screen.getByRole("list", { name: "Filtros" })).getByRole("button", { name: "Total" }))
        await user.type(screen.getByRole("textbox", { name: "Total desde" }), "500000")
        await user.keyboard("{Escape}")
        expect(url().get("total_min")).toBeNull()

        await user.click(within(toolbar()).getByRole("button", { name: "Filtros" }))
        await user.click(within(screen.getByRole("list", { name: "Filtros" })).getByRole("button", { name: "Total" }))
        await user.type(screen.getByRole("textbox", { name: "Total desde" }), "500000")
        await user.click(document.body)
        await waitFor(() => expect(url().get("total_min")).toBe("500000"))
    })

    it("adds a secondary sort key and flips a direction", async () => {
        const { user, url } = setup()
        await user.click(within(toolbar()).getByRole("button", { name: /^Ordenar/ }))
        await user.click(screen.getByRole("button", { name: "Agregar orden secundario" }))
        await waitFor(() => expect(url().get("ordering")).toBe("-number,customer"))
        await user.click(screen.getByRole("button", { name: "Folio: descendente, cambiar a ascendente" }))
        await waitFor(() => expect(url().get("ordering")).toBe("number,customer"))
        expect(within(toolbar()).getByRole("button", { name: "Ordenar: Folio ascendente y 1 más" })).toHaveTextContent("Folio ↑ +1")
    })

    it("groups through the group menu", async () => {
        const { user, url } = setup()
        await user.click(within(toolbar()).getByRole("button", { name: "Agrupar" }))
        await user.click(screen.getByRole("radio", { name: "Cliente" }))
        await waitFor(() => expect(url().get("group_by")).toBe("customer"))
        expect(within(toolbar()).getByRole("button", { name: "Agrupar: Cliente" })).toBeInTheDocument()
    })

    it("hides a column from the display menu but never the identifier column", async () => {
        const { user } = setup()
        await user.click(within(toolbar()).getByRole("button", { name: "Vista" }))
        expect(screen.getByRole("checkbox", { name: "Folio" })).toBeDisabled()
        await user.click(screen.getByRole("checkbox", { name: "Cliente" }))
        await waitFor(() => expect(screen.queryByRole("columnheader", { name: /Cliente/ })).toBeNull())
        expect(screen.getByRole("columnheader", { name: /Folio/ })).toBeInTheDocument()
    })

    it("switches views and offers «Restablecer» once filters drift", async () => {
        const { user, url } = setup()
        await user.click(screen.getByRole("tab", { name: "Borradores" }))
        await waitFor(() => expect(url().get("v")).toBe("drafts"))
        expect(url().get("status")).toBe("DRAFT")
        expect(screen.getByRole("tab", { name: "Borradores" })).toHaveAttribute("aria-selected", "true")
        await user.click(within(screen.getByRole("list", { name: "Filtros aplicados" })).getByRole("button", { name: "Quitar Estado: Borrador" }))
        await user.click(await screen.findByRole("button", { name: "Restablecer" }))
        await waitFor(() => expect(url().get("status")).toBe("DRAFT"))
    })
})
