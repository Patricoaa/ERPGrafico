import { fireEvent, render, screen, within } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import type { TerminalSale } from "../../types"

const m = vi.hoisted(() => ({
    sales: [] as unknown[],
    useTerminalSales: vi.fn(),
    filters: {} as Record<string, string>,
    applyFilter: vi.fn(() => Promise.resolve()),
    push: vi.fn(),
    panel: { selectedId: null as number | null, open: false },
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: m.push, replace: vi.fn() }),
    usePathname: () => "/treasury/terminal-cobro/sales",
}))
vi.mock("@/hooks/useViewMode", () => ({ useViewMode: () => ({ currentView: "list", handleViewChange: vi.fn() }) }))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({
        selectedId: m.panel.selectedId,
        open: m.panel.open,
        close: vi.fn(),
        tab: { id: m.panel.selectedId, open: m.panel.open, onClose: vi.fn() },
    }),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ label, open, children }: { label: string; open: boolean; children: (open: boolean) => React.ReactNode }) => (
        <div data-testid={`panel-tab-${label}`}>{children(open)}</div>
    ),
}))
vi.mock("../TerminalSaleDrawer", () => ({
    TerminalSaleDrawer: ({ id, open }: { id: number | null; open: boolean }) => (open ? <div>drawer-venta #{id}</div> : null),
}))
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: () => ({
            filters: m.filters,
            filterFn: (x: unknown[]) => x,
            isFiltered: Object.keys(m.filters).length > 0,
            applyFilter: m.applyFilter,
            clearAll: vi.fn(),
        }),
        bindUnifiedSearch: () => ({}),
    }
})
vi.mock("../../hooks/useTerminalSales", () => ({
    useTerminalSales: (filters: unknown) => {
        m.useTerminalSales(filters)
        return { page: { count: m.sales.length, results: m.sales }, sales: m.sales, totalCount: m.sales.length, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }
    },
    useTerminalSalesSummary: () => {
        throw new Error("la vista no debe consultar el resumen")
    },
    useTerminalSale: () => ({ sale: undefined, isLoading: false, isError: false }),
}))
vi.mock("../../hooks/useTerminalProviders", () => ({ useTerminalProviders: () => ({ providers: [] }) }))
vi.mock("../../hooks/useTerminalSync", () => ({ useStartTerminalSync: () => ({ startSync: vi.fn(), isStarting: false }) }))

import { TerminalSalesClientView } from "../TerminalSalesClientView"

const sale: TerminalSale = {
    id: 1, provider: 1, provider_name: "TUU Local", device: null, device_name: null, serial_number: "SN1",
    sale_id: "13347", sequence_number: "", location_id: "", transaction_at: "2026-11-12T10:00:00-03:00",
    status: "COMPLETED", raw_status: "Completed", payment_type: "CASH", document_type: 39, document_type_label: "Boleta Electrónica", dte_type: "BOLETA",
    instance: null, card_brand: "", card_issuer: "", installment_count: null, currency: "CLP",
    sale_amount: "3200", tip_amount: "0", cashback_amount: "0", total_amount: "3200",
    commission_amount: null, net_amount: null, settlement_date: null, settlement_id: null, settlement_amount: null,
}

const PERIOD = { date_from: "2026-10-01", date_to: "2026-10-31" }

describe("TerminalSalesClientView", () => {
    beforeEach(() => {
        m.sales = []
        m.filters = {}
        m.useTerminalSales.mockClear()
        m.applyFilter.mockClear()
        m.push.mockClear()
        m.panel = { selectedId: null, open: false }
    })

    it("sin filtros en la URL lista todas las ventas: no inyecta un período por defecto", () => {
        render(<TerminalSalesClientView />)
        expect(m.applyFilter).not.toHaveBeenCalled()
        expect(m.useTerminalSales).toHaveBeenCalledTimes(1)
        expect(m.useTerminalSales).toHaveBeenCalledWith(expect.objectContaining({ date_from: undefined, date_to: undefined, page: 1 }))
    })

    it("con período en la URL consulta ese rango", () => {
        m.filters = { ...PERIOD }
        render(<TerminalSalesClientView />)
        expect(m.applyFilter).not.toHaveBeenCalled()
        expect(m.useTerminalSales).toHaveBeenCalledWith(expect.objectContaining(PERIOD))
    })

    it("no muestra tarjetas de resumen", () => {
        m.sales = [sale]
        render(<TerminalSalesClientView />)
        expect(screen.queryByRole("group", { name: "Resumen del período" })).not.toBeInTheDocument()
        expect(screen.queryByText("Bruto")).not.toBeInTheDocument()
    })

    it("sin filtros y sin filas muestra el estado vacío sin sincronizaciones", () => {
        render(<TerminalSalesClientView />)
        expect(screen.getByText("Aún no hay ventas sincronizadas")).toBeInTheDocument()
        expect(screen.getByText("Activa la sincronización en Tesorería → Configuración o usa «Sincronizar ahora».")).toBeInTheDocument()
    })

    it("con filtros y sin filas muestra el vacío filtrado, no el de sin sincronizaciones", () => {
        m.filters = { ...PERIOD }
        render(<TerminalSalesClientView />)
        expect(screen.getByText("Ningún resultado para el filtro")).toBeInTheDocument()
        expect(screen.queryByText("Aún no hay ventas sincronizadas")).not.toBeInTheDocument()
    })

    it("abrir una fila selecciona la venta vía ?selected", () => {
        m.sales = [sale]
        render(<TerminalSalesClientView />)
        fireEvent.click(screen.getByText("13347"))
        expect(m.push).toHaveBeenCalledWith("/treasury/terminal-cobro/sales?selected=1", { scroll: false })
    })

    it("con ?selected monta la ficha de la venta como pestaña de entidad", () => {
        m.panel = { selectedId: 1, open: true }
        render(<TerminalSalesClientView />)
        expect(within(screen.getByTestId("panel-tab-treasury.terminalsale")).getByText("drawer-venta #1")).toBeInTheDocument()
    })
})
