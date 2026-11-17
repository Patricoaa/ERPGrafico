import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FiscalMatchCounts, FiscalMatchFilters, FiscalMatchListItem, MonthlySummaryRow, PendingIssue } from "../../types/fiscalMatch"

const m = vi.hoisted(() => ({
    filters: {} as Record<string, string>,
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
    summary: undefined as unknown,
    summaryCalls: [] as [number, number][],
    pending: undefined as unknown,
    openEntity: vi.fn(),
}))

vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: () => ({
            filters: m.filters,
            isFiltered: Object.keys(m.filters).length > 0,
            applyFilter: m.applyFilter,
            removeFilter: m.removeFilter,
            clearAll: vi.fn(),
        }),
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
    useFiscalMatchCounts: () => ({ counts: m.counts, isLoading: m.countsLoading, isError: m.countsError, refetch: vi.fn() }),
    useFiscalMatchSummary: (year: number, month: number) => {
        m.summaryCalls.push([year, month])
        return { summary: m.summary, isLoading: false, isError: false, isRefetching: false, refetch: vi.fn() }
    },
    usePendingIssue: () => ({ pendingIssue: m.pending, isLoading: false, isError: false, isRefetching: false, refetch: vi.fn() }),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ year: 2026, month: 11 }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModalActions: () => ({ openEntity: m.openEntity }),
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

const summary: MonthlySummaryRow[] = [
    { dte_type: 39, erp_count: 2, erp_total: "3000.00", tuu_count: 2, tuu_total: "3000.00", expected_total: "3000.00", rcv_count: 2, rcv_total: "3000.00", difference: "0.00" },
    { dte_type: 48, erp_count: 1, erp_total: "9990.00", tuu_count: 2, tuu_total: "34990.00", expected_total: "34990.00", rcv_count: 2, rcv_total: "34990.00", difference: "0.00" },
]

const pending: PendingIssue = {
    count: 1,
    items: [{ id: 901, group: 31, label: "Boleta Electrónica sin folio (#901)", amount: "1500", date: "2026-11-03", reason: "NO_TUU", error: null }],
}

beforeEach(() => {
    m.filters = {}
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
    m.summary = summary
    m.summaryCalls = []
    m.pending = pending
    m.openEntity.mockReset()
})

describe("FiscalMatchClientView", () => {
    it("renders counts and opens in attention filter", async () => {
        render(<FiscalMatchClientView />)

        expect(m.listCalls.at(-1)).toEqual([{ direction: "sale", status: ["attention"] }, 1])
        const quick = screen.getByRole("group", { name: "Filtros rápidos por estado" })
        const attention = within(quick).getByRole("button", { name: /Necesita atención\s*44/ })
        expect(attention).toHaveAttribute("aria-pressed", "true")
        expect(within(quick).getByRole("button", { name: /Cuadrado\s*1\.204/ })).toHaveAttribute("aria-pressed", "false")

        await userEvent.click(within(quick).getByRole("button", { name: /Con diferencia\s*5/ }))
        expect(m.applyFilter).toHaveBeenCalledWith("status", "DIFF")
        expect(screen.getByText(/Última revisión: hace 4 minutos/)).toBeInTheDocument()
    })

    it("applies the URL filters and marks the chosen status", () => {
        m.filters = { direction: "purchase", status: "DIFF", dte_type: "33", search: "1532" }
        render(<FiscalMatchClientView />)

        expect(m.listCalls.at(-1)).toEqual([{ direction: "purchase", status: ["DIFF"], dte_type: 33, search: "1532" }, 1])
        const quick = screen.getByRole("group", { name: "Filtros rápidos por estado" })
        expect(within(quick).getByRole("button", { name: /Con diferencia\s*5/ })).toHaveAttribute("aria-pressed", "true")
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
            expect.arrayContaining(["Documento ERP", "Pagos TUU", "RCV (SII)", "Estado"]),
        )
        expect(within(table).getByText("Boleta 39 · $12.500")).toBeInTheDocument()
        expect(within(table).getByText("1 venta · $12.500")).toBeInTheDocument()
        expect(within(table).getByText("Folio 88213")).toBeInTheDocument()
        expect(within(table).getByText("(sin documento)")).toBeInTheDocument()
        expect(within(table).getByText("Falta en el ERP")).toBeInTheDocument()

        await userEvent.click(within(table).getByRole("button", { name: /Boleta 39 · \$12\.500/ }))
        expect(m.openEntity).toHaveBeenCalledWith("tax.fiscalmatch", 1)
    })

    it("has no recalculate buttons", () => {
        render(<FiscalMatchClientView />)
        expect(screen.queryByRole("button", { name: /recalcular/i })).toBeNull()
        expect(screen.queryByRole("group", { name: "Año" })).toBeInTheDocument() // solo el del resumen mensual
        expect(screen.getAllByRole("group", { name: "Año" })).toHaveLength(1)
    })

    it("shows 48 expected column", () => {
        render(<FiscalMatchClientView />)
        expect(m.summaryCalls.at(-1)).toEqual([2026, 11])
        expect(screen.getByRole("heading", { name: "Resumen mensual de boletas y comprobantes" })).toBeInTheDocument()
        const table = screen.getByRole("table", { name: "Resumen mensual de boletas y comprobantes" })
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
            expect.arrayContaining(["ERP", "TUU", "48 esperado", "SII", "Diferencia"]),
        )
        const row48 = within(table).getByText("48 · Comprobante de pago electrónico").closest("tr") as HTMLElement
        expect(within(row48).getAllByText("$34.990").length).toBeGreaterThanOrEqual(2)
        const row39 = within(table).getByText("39 · Boleta Electrónica").closest("tr") as HTMLElement
        expect(within(row39).getByText("—")).toBeInTheDocument()
    })

    it("lists the drafts waiting for a folio and opens their group", async () => {
        render(<FiscalMatchClientView />)
        expect(screen.getByRole("heading", { name: "Boletas pendientes de folio" })).toBeInTheDocument()
        const table = screen.getByRole("table", { name: "Boletas pendientes de folio" })
        expect(within(table).getByText("Sin venta TUU")).toBeInTheDocument()
        await userEvent.click(within(table).getByRole("button", { name: /Boleta Electrónica sin folio/ }))
        expect(m.openEntity).toHaveBeenCalledWith("tax.fiscalmatch", 31)
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
            await userEvent.click(retry[retry.length - 1])
            expect(m.listRefetch).toHaveBeenCalled()
        })
    })
})
