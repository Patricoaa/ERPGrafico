import { render, screen, within } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { format, subDays } from "date-fns"
import type { TerminalSale, TerminalSalesSummary } from "../../types"

const m = vi.hoisted(() => ({
    sales: [] as unknown[],
    summary: undefined as unknown,
    useTerminalSales: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/treasury/terminal-cobro/sales",
}))
vi.mock("@/hooks/useViewMode", () => ({ useViewMode: () => ({ currentView: "list", handleViewChange: vi.fn() }) }))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({ selectedId: null, open: false, close: vi.fn(), tab: {} }),
}))
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: () => ({ filters: {}, filterFn: (x: unknown[]) => x, isFiltered: false, clearAll: vi.fn() }),
        bindUnifiedSearch: () => ({}),
    }
})
vi.mock("../../hooks/useTerminalSales", () => ({
    useTerminalSales: (filters: unknown) => {
        m.useTerminalSales(filters)
        return { page: { count: m.sales.length, results: m.sales }, sales: m.sales, totalCount: m.sales.length, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }
    },
    useTerminalSalesSummary: () => ({ summary: m.summary, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }),
    useTerminalSale: () => ({ sale: undefined, isLoading: false, isError: false }),
}))
vi.mock("../../hooks/useTerminalProviders", () => ({ useTerminalProviders: () => ({ providers: [] }) }))
vi.mock("../../hooks/useTerminalSync", () => ({ useStartTerminalSync: () => ({ startSync: vi.fn(), isStarting: false }) }))

import { TerminalSalesClientView } from "../TerminalSalesClientView"

const summary: TerminalSalesSummary = {
    count: 12,
    gross: "120000",
    commission: "3500",
    net: "116500",
    by_payment_type: [],
    non_completed: { count: 2, total: "8000" },
}

const sale: TerminalSale = {
    id: 1, provider: 1, provider_name: "TUU Local", device: null, device_name: null, serial_number: "SN1",
    sale_id: "13347", sequence_number: "", location_id: "", transaction_at: "2026-11-12T10:00:00-03:00",
    status: "COMPLETED", raw_status: "Completed", payment_type: "CASH", document_type: 39, document_type_label: "Boleta",
    instance: null, card_brand: "", card_issuer: "", installment_count: null, currency: "CLP",
    sale_amount: "3200", tip_amount: "0", cashback_amount: "0", total_amount: "3200",
    commission_amount: null, net_amount: null, settlement_date: null, settlement_id: null, settlement_amount: null,
}

describe("TerminalSalesClientView", () => {
    beforeEach(() => {
        m.sales = []
        m.summary = undefined
        m.useTerminalSales.mockClear()
    })

    it("consulta por defecto los últimos 7 días", () => {
        render(<TerminalSalesClientView />)
        const now = new Date()
        expect(m.useTerminalSales).toHaveBeenCalledWith(expect.objectContaining({
            date_from: format(subDays(now, 6), "yyyy-MM-dd"),
            date_to: format(now, "yyyy-MM-dd"),
            page: 1,
        }))
    })

    it("muestra el resumen del período con los montos del hook", () => {
        m.summary = summary
        m.sales = [sale]
        render(<TerminalSalesClientView />)
        const panel = screen.getByLabelText("Resumen del período")
        expect(within(panel).getByText("12")).toBeInTheDocument()
        expect(within(panel).getByText("$120.000")).toBeInTheDocument()
        expect(within(panel).getByText("$-3.500")).toBeInTheDocument()
        expect(within(panel).getByText("$116.500")).toBeInTheDocument()
        expect(within(panel).getByText("No completadas")).toBeInTheDocument()
        expect(within(panel).getByText("$8.000")).toBeInTheDocument()
        expect(within(panel).getByText("2 ventas fuera de los totales")).toBeInTheDocument()
    })

    it("oculta las no completadas cuando no hay", () => {
        m.summary = { ...summary, non_completed: { count: 0, total: "0" } }
        render(<TerminalSalesClientView />)
        expect(screen.queryByText("No completadas")).not.toBeInTheDocument()
    })

    it("muestra el estado vacío sin ventas sincronizadas", () => {
        render(<TerminalSalesClientView />)
        expect(screen.getByText("Aún no hay ventas sincronizadas")).toBeInTheDocument()
        expect(screen.getByText("Activa la sincronización en Tesorería → Configuración o usa «Sincronizar ahora».")).toBeInTheDocument()
    })
})
