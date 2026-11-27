import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RefreshCw } from "lucide-react"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { Collection, defineEntity, useCollectionAnalytics, useCollectionQuery, useEntityCollection, type ToolbarExtraAction } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { useAnalyticsDrillDown } from "@/components/shared"

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
        customer: f.text("customer", { label: "Cliente", orderBy: "customer__name", groupKey: "customer" }),
        status: f.text("status", { label: "Estado", groupKey: "status" }),
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

const STATUS_DRILL = { param: "status", values: { Borradores: "DRAFT" } }

/** Stands in for a drillable chart: a click on the "Borradores" category. */
function DrillProbe({ scope }: { scope: string }) {
    const drill = useAnalyticsDrillDown(STATUS_DRILL)
    return (
        <>
            <p>Alcance: {scope}</p>
            <Button onClick={() => drill?.("Borradores")}>Segmento Borradores</Button>
        </>
    )
}

function Screen({ action = <Button>Nueva nota</Button>, extraActions }: { action?: ReactNode; extraActions?: readonly ToolbarExtraAction[] }) {
    const query = useCollectionQuery(noteEntity)
    const analytics = useCollectionAnalytics("resumen")
    const collection = useEntityCollection(noteEntity, { rows, rowCount: 2 }, { pagination: { mode: "none" }, sorting: query.sorting, groupBy: query.groupBy })
    return (
        <Collection.Root collection={collection} query={query} analytics={analytics} label="Notas de venta">
            <Collection.Toolbar action={action} extraActions={extraActions} />
            <Collection.View table={noteViews.table} />
            <Collection.Analytics>
                <DrillProbe scope={analytics.scope} />
            </Collection.Analytics>
        </Collection.Root>
    )
}

function stubViewport(mobile: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: mobile,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    }))
}

afterEach(() => vi.unstubAllGlobals())

function setup(search = "", options?: { action?: ReactNode; extraActions?: readonly ToolbarExtraAction[]; mobile?: boolean }) {
    window.localStorage.clear()
    if (options?.mobile !== undefined) stubViewport(options.mobile)
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    render(
        <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
            <Screen action={options?.action} extraActions={options?.extraActions} />
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

    it("shows a single predefined view as visible context (Decision A)", async () => {
        const singleViewEntity = defineEntity<Note>()((f) => ({
            title: "Notas",
            fields: { number: f.code("number", { label: "Folio" }) },
            query: { views: [{ id: "all", label: "Todas" }] },
        }))
        const singleViews = singleViewEntity.views({ table: { columns: ["number"] } })

        function SingleToolbar() {
            const query = useCollectionQuery(singleViewEntity, { sorting: "client" })
            const collection = useEntityCollection(singleViewEntity, { rows, isLoading: false }, { sorting: query.sorting })
            return (
                <Collection.Root collection={collection} query={query} view="table" onViewChange={vi.fn()}>
                    <Collection.Toolbar />
                    <Collection.View table={singleViews.table} />
                </Collection.Root>
            )
        }

        render(<NuqsTestingAdapter><SingleToolbar /></NuqsTestingAdapter>)
        const tab = screen.getByRole("tab", { name: "Todas" })
        expect(tab).toHaveAttribute("aria-selected", "true")
        expect(screen.getByRole("tablist", { name: "Vistas" })).toBeInTheDocument()
    })
})

describe("Collection utility row and narrow toolbar (ADR-0158 §1–2)", () => {
    it("keeps only the primary action in the toolbar and moves analytics to the top row", () => {
        setup()
        const bar = toolbar()
        const buttons = within(bar).getAllByRole("button")
        expect(buttons.at(-1)).toHaveTextContent("Nueva nota")
        const utilities = screen.getByRole("group", { name: "Acciones de la colección" })
        expect(within(utilities).getByRole("button", { name: "Analítica" })).toBeInTheDocument()
        expect(within(bar).queryByRole("button", { name: "Analítica" })).toBeNull()
    })

    it("renders extra actions as ghost icon-only buttons in the top row", async () => {
        const onClick = vi.fn()
        const { user } = setup("", { extraActions: [{ id: "refresh", icon: RefreshCw, label: "Actualizar", onClick }] })
        const utilities = screen.getByRole("group", { name: "Acciones de la colección" })
        const extra = within(utilities).getByRole("button", { name: "Actualizar" })
        expect(extra).toHaveAttribute("title", "Actualizar")
        expect(extra).toHaveTextContent("")
        expect(extra.querySelector("svg")).toBeInTheDocument()
        await user.click(extra)
        expect(onClick).toHaveBeenCalledOnce()
    })

    it("renders extra action links and disabled actions without an onClick", () => {
        setup("", {
            extraActions: [
                { id: "docs", icon: RefreshCw, label: "Documentación", href: "/docs" },
                { id: "locked", icon: RefreshCw, label: "Bloqueada", disabled: true },
            ],
        })
        const utilities = screen.getByRole("group", { name: "Acciones de la colección" })
        const link = within(utilities).getByRole("link", { name: "Documentación" })
        expect(link).toHaveAttribute("href", "/docs")
        expect(link).toHaveAttribute("title", "Documentación")
        expect(within(utilities).getByRole("button", { name: "Bloqueada" })).toBeDisabled()
    })

    it("announces a single active change and toggles aria-expanded on «Ajustes»", async () => {
        const { user } = setup("ordering=customer", { mobile: true })
        const settings = within(toolbar()).getByRole("button", { name: /Ajustes/ })
        expect(settings).toHaveAttribute("aria-label", "Ajustes: 1 cambio")
        expect(settings).toHaveAttribute("title", "Ajustes")
        expect(settings).toHaveAttribute("aria-expanded", "false")
        await user.click(settings)
        expect(settings).toHaveAttribute("aria-expanded", "true")
    })

    it("shows the total at the end of AppliedFilters, not beside the view tabs", () => {
        setup()
        expect(screen.getByText("2 resultados")).toBeInTheDocument()
        expect(within(screen.getByRole("tablist", { name: "Vistas" })).queryByText("2 resultados")).toBeNull()
    })

    it("collapses the four tools into «Ajustes» with their active-change count below md", async () => {
        const { user, url } = setup("status=DRAFT&ordering=customer&group_by=status", { mobile: true })
        const bar = toolbar()
        const settings = within(bar).getByRole("button", { name: /Ajustes/ })
        expect(settings).toHaveAttribute("title", "Ajustes")
        expect(settings).toHaveTextContent("3")
        for (const name of [/^Filtros/, /^Ordenar/, /^Agrupar/, /^Vista/]) {
            expect(within(bar).queryByRole("button", { name })).toBeNull()
        }
        expect(within(bar).getByRole("button", { name: "Nueva nota" }).parentElement).toHaveClass("basis-full")
        await user.click(settings)
        expect(screen.getByRole("list", { name: "Filtros" })).toBeInTheDocument()
        await user.click(screen.getByRole("checkbox", { name: "Confirmada" }))
        await user.click(screen.getByRole("button", { name: /^Aplicar/ }))
        await waitFor(() => expect(url().get("status")).toContain("CONFIRMED"))
    })

    it("commits the pending filter draft when «Ajustes» closes, not only with «Aplicar»", async () => {
        const { user, url } = setup("status=DRAFT", { mobile: true })
        const settings = within(toolbar()).getByRole("button", { name: /Ajustes/ })
        await user.click(settings)
        await user.click(screen.getByRole("checkbox", { name: "Confirmada" }))
        await user.click(settings)
        await waitFor(() => expect(url().get("status")).toContain("CONFIRMED"))
    })

    it("discards the pending filter draft when «Ajustes» receives Escape", async () => {
        const { user, url } = setup("status=DRAFT", { mobile: true })
        await user.click(within(toolbar()).getByRole("button", { name: /Ajustes/ }))
        await user.click(screen.getByRole("checkbox", { name: "Confirmada" }))
        await user.keyboard("{Escape}")
        expect(url().get("status")).toBe("DRAFT")
    })
})

describe("Analytics modal scope and drill-down (ADR-0158 stage 3c)", () => {
    it("states what it analyses, with the list's filters read-only", async () => {
        setup("v=drafts&status=DRAFT&analytics=resumen")
        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText(/Analizando/)).toHaveTextContent("Analizando con la vista Borradores")
        const chips = within(dialog).getByRole("list", { name: "Filtros aplicados" })
        expect(chips).toHaveTextContent("Estado: Borrador")
        expect(within(chips).queryByRole("button")).toBeNull()
        expect(within(dialog).queryByRole("button", { name: "Limpiar todo" })).toBeNull()
    })

    it("does not name a view the filters no longer match", async () => {
        setup("status=DRAFT&analytics=resumen")
        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText(/Analizando/)).toHaveTextContent(/^Analizando con los filtros de la lista$/)
    })

    it("«Analizar sin filtros» widens the scope inside the modal only", async () => {
        const { user, url } = setup("status=DRAFT&analytics=resumen")
        const dialog = await screen.findByRole("dialog")
        await user.click(within(dialog).getByRole("button", { name: "Analizar sin filtros" }))
        expect(within(dialog).getByText("Alcance: all")).toBeInTheDocument()
        expect(within(dialog).getByText(/Analizando/)).toHaveTextContent("Analizando todos los registros, sin filtros")
        expect(url().get("status")).toBe("DRAFT")
        await user.click(within(dialog).getByRole("button", { name: "Usar los filtros de la lista" }))
        expect(within(dialog).getByText("Alcance: query")).toBeInTheDocument()
    })

    it("a drill-down applies the clicked category as a filter and closes the modal in one URL update", async () => {
        const { user, url } = setup("analytics=resumen")
        const dialog = await screen.findByRole("dialog")
        await user.click(within(dialog).getByRole("button", { name: "Segmento Borradores" }))
        await waitFor(() => expect(url().get("status")).toBe("DRAFT"))
        expect(url().has("analytics")).toBe(false)
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(within(screen.getByRole("list", { name: "Filtros aplicados" })).getByRole("button", { name: "Quitar Estado: Borrador" })).toBeInTheDocument()
    })
})
