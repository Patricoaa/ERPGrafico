import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FiscalMatchCounts, FiscalMatchFilters, FiscalMatchListItem } from "../../types/fiscalMatch"

const m = vi.hoisted(() => ({
    filters: {} as Record<string, string>,
    filterOptions: undefined as Record<string, { label: string; value: string }[]> | undefined,
    applyFilter: vi.fn(),
    removeFilter: vi.fn(),
    groups: [] as unknown[],
    listLoading: false,
    listError: false,
    listRefetch: vi.fn(),
    listCalls: [] as [unknown, number][],
    counts: undefined as unknown,
    countsLoading: false,
    countsError: false,
    countsRefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    query: "status=attention",
    selectedId: null as number | null,
}))

vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: (_config: unknown, filterOptions?: Record<string, { label: string; value: string }[]>) => {
            m.filterOptions = filterOptions
            return {
                filters: m.filters,
                isFiltered: Object.keys(m.filters).length > 0,
                applyFilter: m.applyFilter,
                removeFilter: m.removeFilter,
                clearAll: vi.fn(),
            }
        },
        bindUnifiedSearch: () => ({}),
    }
})
vi.mock("../../hooks/useFiscalMatches", () => ({
    useFiscalMatches: (filters: FiscalMatchFilters, page: number) => {
        m.listCalls.push([filters, page])
        return {
            page: m.listLoading ? undefined : { count: m.groups.length, results: m.groups },
            groups: m.groups,
            totalCount: m.groups.length,
            isLoading: m.listLoading,
            isError: m.listError,
            isRefetching: false,
            refetch: m.listRefetch,
        }
    },
    useFiscalMatchCounts: () => ({ counts: m.counts, isLoading: m.countsLoading, isError: m.countsError, refetch: m.countsRefetch }),
}))
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(m.query),
    useRouter: () => ({ push: m.push, replace: m.replace }),
    usePathname: () => "/accounting/rcv/cuadre",
}))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({
        selectedId: m.selectedId,
        open: m.selectedId !== null,
        close: vi.fn(),
        tab: { id: m.selectedId, open: m.selectedId !== null, onClose: vi.fn() },
    }),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ label, open, children }: { label: string; open: boolean; children: (open: boolean) => React.ReactNode }) => (
        <div data-testid={`panel-tab-${label}`}>{children(open)}</div>
    ),
}))
vi.mock("../FiscalMatchDrawer", () => ({
    FiscalMatchDrawer: ({ id, open, onGroupChange }: { id: number | null; open: boolean; onGroupChange?: (id: number) => void }) =>
        open ? <button type="button" onClick={() => onGroupChange?.(42)}>{`ficha del grupo #${id}`}</button> : null,
}))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: () => true, hasPermission: () => true }) }))

import { FiscalMatchClientView } from "../FiscalMatchClientView"

const base: FiscalMatchListItem = {
    id: 1,
    direction: "sale",
    status: "MATCHED",
    status_display: "Cuadrado",
    erp_state: "MATCHED",
    tuu_state: "MATCHED",
    rcv_state: "MATCHED",
    dte_type: 39,
    issue_date: "2026-11-10",
    erp_amount: "12500.00",
    tuu_amount: "12500.00",
    rcv_amount: "12500.00",
    invoice: { id: 77, display_id: "BOL-88213" },
    terminal_sales: [{ id: 5, transaction_at: "2026-11-10T14:02:00-03:00", sale_amount: "12500.00" }],
    rcv_documents: [{ id: 9, folio: "88213" }],
    notice: "",
    closed_period_alert: false,
    issue_error: "",
}

const orphan: FiscalMatchListItem = {
    ...base,
    id: 2,
    status: "MISSING_ERP",
    status_display: "Falta en el ERP",
    erp_state: "MISSING",
    erp_amount: null,
    invoice: null,
    tuu_amount: "7000.00",
    terminal_sales: [{ id: 6, transaction_at: "2026-11-10T15:00:00-03:00", sale_amount: "7000.00" }],
    rcv_documents: [{ id: 10, folio: "88290" }],
}

const counts: FiscalMatchCounts = {
    by_status: { MATCHED: 1204, PENDING: 37, DIFF: 5, AMBIGUOUS: 2, MISSING_ERP: 0, MISSING_EXTERNAL: 0, EXCLUDED: 0 },
    last_run_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    start_date: "2026-10-01",
}

beforeEach(() => {
    m.filters = {}
    m.query = "status=attention"
    m.replace.mockReset()
    m.filterOptions = undefined
    m.applyFilter.mockReset()
    m.removeFilter.mockReset()
    m.groups = [base, orphan]
    m.listLoading = false
    m.listError = false
    m.listRefetch.mockReset()
    m.listCalls = []
    m.counts = counts
    m.countsLoading = false
    m.countsError = false
    m.countsRefetch.mockReset()
    m.push.mockReset()
    m.selectedId = null
})

describe("FiscalMatchClientView", () => {
    it("muestra los conteos dentro del buscador y abre en necesita atención", () => {
        render(<FiscalMatchClientView />)

        expect(m.listCalls.at(-1)).toEqual([{ direction: "sale", status: ["attention"] }, 1])
        expect(m.filterOptions?.status).toEqual(expect.arrayContaining([
            { label: "Necesita atención (44)", value: "attention" },
            { label: "Cuadrado (1.204)", value: "MATCHED" },
            { label: "Con diferencia (5)", value: "DIFF" },
            { label: "Todos (1.248)", value: "all" },
        ]))
        expect(screen.getByText(/Última revisión: hace 4 minutos/)).toBeInTheDocument()
        expect(screen.queryByRole("group", { name: "Filtros rápidos por estado" })).toBeNull()
        expect(screen.queryByRole("group", { name: "Dirección" })).toBeNull()
    })

    it("applies the URL filters", () => {
        m.filters = { direction: "purchase", status: "DIFF", dte_type: "33", search: "1532" }
        render(<FiscalMatchClientView />)

        expect(m.listCalls.at(-1)).toEqual([{ direction: "purchase", status: ["DIFF"], dte_type: 33, search: "1532" }, 1])
    })

    it("direction=all omite el filtro de dirección", () => {
        m.filters = { direction: "all" }
        render(<FiscalMatchClientView />)

        expect(m.listCalls.at(-1)).toEqual([{ status: ["attention"] }, 1])
    })

    it("usa todo el alto disponible y no muestra las secciones retiradas", () => {
        const { container } = render(<FiscalMatchClientView />)

        expect(container.firstChild).toHaveClass("flex", "flex-1", "min-h-0", "flex-col")
        expect(screen.queryByRole("heading", { name: "Boletas pendientes de folio" })).toBeNull()
        expect(screen.queryByRole("heading", { name: "Resumen mensual de boletas y comprobantes" })).toBeNull()
        expect(screen.getByRole("table", { name: "Cuadre" })).toBeInTheDocument()
    })

    it("status=all lists every group", () => {
        m.filters = { status: "all" }
        render(<FiscalMatchClientView />)
        expect(m.listCalls.at(-1)).toEqual([{ direction: "sale" }, 1])
    })

    it("shows each part with its state and a short text, and opens the group", async () => {
        render(<FiscalMatchClientView />)
        const table = screen.getByRole("table", { name: "Cuadre" })
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
            expect.arrayContaining(["Documento ERP", "Dirección", "Pagos TUU", "RCV (SII)", "Estado"]),
        )
        expect(within(table).getByText("Boleta 39 · $12.500")).toBeInTheDocument()
        expect(within(table).getByText("1 venta · $12.500")).toBeInTheDocument()
        expect(within(table).getByText("Folio 88213")).toBeInTheDocument()
        expect(within(table).getByText("(sin documento)")).toBeInTheDocument()
        expect(within(table).getByText("Falta en el ERP")).toBeInTheDocument()

        await userEvent.click(within(table).getByRole("button", { name: /Boleta 39 · \$12\.500/ }))
        expect(m.push).toHaveBeenCalledWith("/accounting/rcv/cuadre?status=attention&selected=1", { scroll: false })
    })

    it("una URL limpia recibe los filtros por defecto (chips y «Limpiar» visibles)", () => {
        m.query = ""
        render(<FiscalMatchClientView />)
        expect(m.replace).toHaveBeenCalledTimes(1)
        expect(m.replace).toHaveBeenCalledWith("/accounting/rcv/cuadre?direction=sale&status=attention", { scroll: false })
    })

    it("conserva los parámetros presentes al completar los por defecto", () => {
        m.query = "selected=5&status=all"
        render(<FiscalMatchClientView />)
        expect(m.replace).toHaveBeenCalledWith("/accounting/rcv/cuadre?selected=5&status=all&direction=sale", { scroll: false })
    })

    it("no reescribe la URL cuando ya trae dirección y estado", () => {
        m.query = "direction=all&status=attention"
        const { rerender } = render(<FiscalMatchClientView />)
        rerender(<FiscalMatchClientView />)
        expect(m.replace).not.toHaveBeenCalled()
    })

    it("has no recalculate buttons or summary selectors", () => {
        render(<FiscalMatchClientView />)
        expect(screen.queryByRole("button", { name: /recalcular/i })).toBeNull()
        expect(screen.queryByRole("group", { name: "Año" })).toBeNull()
        expect(screen.queryByRole("group", { name: "Mes" })).toBeNull()
    })

    it("?selected abre la ficha del grupo", () => {
        m.selectedId = 5
        render(<FiscalMatchClientView />)
        expect(screen.getByTestId("panel-tab-tax.fiscalmatch")).toHaveTextContent("ficha del grupo #5")
    })

    it("la ficha que sigue a otro grupo actualiza `selected` en la URL", async () => {
        m.selectedId = 5
        m.query = "direction=sale&status=attention&selected=5"
        render(<FiscalMatchClientView />)
        await userEvent.click(screen.getByRole("button", { name: "ficha del grupo #5" }))
        expect(m.replace).toHaveBeenCalledWith("/accounting/rcv/cuadre?direction=sale&status=attention&selected=42", { scroll: false })
    })

    it("start date banner", () => {
        m.counts = { ...counts, start_date: null }
        const { unmount } = render(<FiscalMatchClientView />)
        expect(screen.getByText("Configure la fecha de inicio del cuadre")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Ir a la configuración" })).toHaveAttribute("href", "/accounting/settings/rcv")
        unmount()

        m.counts = counts
        render(<FiscalMatchClientView />)
        expect(screen.queryByText("Configure la fecha de inicio del cuadre")).toBeNull()
    })

    describe("loading/empty/error states", () => {
        it("loading", () => {
            m.groups = []
            m.listLoading = true
            m.counts = undefined
            m.countsLoading = true
            render(<FiscalMatchClientView />)
            expect(screen.getByRole("table", { name: "Cuadre" })).toHaveAttribute("aria-busy", "true")
            expect(screen.getByLabelText("Cargando conteos del cuadre")).toBeInTheDocument()
        })

        it("empty", () => {
            m.groups = []
            render(<FiscalMatchClientView />)
            expect(screen.getByText("Nada necesita atención")).toBeInTheDocument()
        })

        it("error", async () => {
            m.groups = []
            m.listError = true
            m.counts = undefined
            m.countsError = true
            render(<FiscalMatchClientView />)
            expect(screen.getByText("No se pudieron cargar los conteos del cuadre")).toBeInTheDocument()
            const retry = screen.getAllByRole("button", { name: "Reintentar" })
            expect(retry.length).toBeGreaterThanOrEqual(2)
            await userEvent.click(retry[0])
            expect(m.listRefetch).toHaveBeenCalled()
            await userEvent.click(retry[retry.length - 1])
            expect(m.countsRefetch).toHaveBeenCalled()
        })
    })
})
