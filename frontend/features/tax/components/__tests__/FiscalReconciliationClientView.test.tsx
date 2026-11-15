import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FiscalReconciliationReport } from "../../types/reconciliation"

const m = vi.hoisted(() => ({
    report: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    run: vi.fn(),
    requested: [] as [number, number][],
    openEntity: vi.fn(),
}))

vi.mock("../../hooks/useFiscalReconciliation", () => ({
    useFiscalReconciliation: (year: number, month: number) => {
        m.requested.push([year, month])
        return { report: m.report, isLoading: m.isLoading, isError: m.isError, refetch: m.refetch }
    },
    useRunReconciliation: () => ({ mutateAsync: m.run, isPending: false }),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModalActions: () => ({ openEntity: m.openEntity }),
}))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: () => true, hasPermission: () => true }) }))

import { FiscalReconciliationClientView } from "../FiscalReconciliationClientView"

const report: FiscalReconciliationReport = {
    start_date: "2026-10-01",
    documents: {
        purchase: { MATCHED: 12, AMOUNT_DIFF: 1, ONLY_EXTERNAL: 2, EXCLUDED: 3, ONLY_ERP: 1, "": 4 },
        sale: { MATCHED: 40, ONLY_ERP: 0 },
    },
    only_erp: [{ id: 812, label: "Factura de Compra 000123", amount: "119000.00", date: "2026-10-12" }],
    summaries: [
        { dte_type: 39, erp_count: 2, erp_total: "3000.00", tuu_count: 2, tuu_total: "3000.00", rcv_count: 2, rcv_total: "2500.00", difference: "500.00" },
        { dte_type: 41, erp_count: 0, erp_total: "0", tuu_count: 0, tuu_total: "0", rcv_count: 0, rcv_total: "0", difference: "0" },
        { dte_type: 48, erp_count: 5, erp_total: "25000.00", tuu_count: 5, tuu_total: "25000.00", rcv_count: 0, rcv_total: "0", difference: "25000.00" },
    ],
    terminal: { MATCHED: 30, AMBIGUOUS: 1, ONLY_EXTERNAL: 2, ONLY_ERP: 1 },
}

const today = new Date()

beforeEach(() => {
    m.report = report
    m.isLoading = false
    m.isError = false
    m.requested = []
    m.refetch.mockReset()
    m.run.mockReset().mockResolvedValue({})
    m.openEntity.mockReset()
})

describe("FiscalReconciliationClientView", () => {
    it("muestra el selector de período con el mes actual por defecto", () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.getByRole("group", { name: "Año" })).toBeInTheDocument()
        expect(screen.getByRole("group", { name: "Mes" })).toBeInTheDocument()
        expect(m.requested.at(-1)).toEqual([today.getFullYear(), today.getMonth() + 1])
    })

    it("Boletas y comprobantes: ERP · TUU · SII y la diferencia", () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.getByRole("heading", { name: "Boletas y comprobantes" })).toBeInTheDocument()
        const table = screen.getByRole("table", { name: "Boletas y comprobantes" })
        const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent)
        expect(headers).toEqual(expect.arrayContaining(["ERP", "TUU", "SII", "Diferencia"]))
        expect(within(table).getByText("39 · Boleta Electrónica")).toBeInTheDocument()
        expect(within(table).getAllByText("$500").length).toBeGreaterThan(0)
        expect(screen.queryByText("No hay importación RCV de ventas para este período.")).not.toBeInTheDocument()
    })

    it("sin importación RCV de ventas avisa y muestra guiones en SII y diferencia", () => {
        m.report = {
            ...report,
            summaries: report.summaries.map((s) => ({ ...s, rcv_count: null, rcv_total: null, difference: null })),
        }
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("No hay importación RCV de ventas para este período.")).toBeInTheDocument()
        const table = screen.getByRole("table", { name: "Boletas y comprobantes" })
        const row = within(table).getByText("39 · Boleta Electrónica").closest("tr") as HTMLElement
        expect(within(row).getAllByText("—").length).toBe(2)
    })

    it("Facturas y notas: cada conteo filtra la colección de documentos RCV", () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.getByRole("heading", { name: "Facturas y notas" })).toBeInTheDocument()
        const y = today.getFullYear()
        const mo = today.getMonth() + 1
        const link = screen.getByRole("link", { name: "12 compras Cuadrado" })
        expect(link).toHaveAttribute("href", `/accounting/rcv/purchases?year=${y}&month=${mo}&match_status=MATCHED`)
        expect(screen.getByRole("link", { name: "40 ventas Cuadrado" })).toHaveAttribute(
            "href", `/accounting/rcv/sales?year=${y}&month=${mo}&match_status=MATCHED`,
        )
        // "" (no evaluado) se ignora
        expect(screen.queryByRole("link", { name: /^4 compras/ })).not.toBeInTheDocument()
    })

    it("lista «Falta en el SII» y abre la factura", async () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.getByRole("heading", { name: "Falta en el SII" })).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Factura de Compra 000123/ }))
        expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 812)
    })

    it("ofrece Recalcular RCV y Recalcular TUU para el período", async () => {
        render(<FiscalReconciliationClientView />)
        await userEvent.click(screen.getByRole("button", { name: "Recalcular RCV" }))
        const period = { year: today.getFullYear(), month: today.getMonth() + 1 }
        expect(m.run).toHaveBeenCalledWith({ source: "rcv", ...period })
        await userEvent.click(screen.getByRole("button", { name: "Recalcular TUU" }))
        expect(m.run).toHaveBeenCalledWith({ source: "terminal", ...period })
    })

    it("sin fecha de inicio pide configurarla", () => {
        m.report = { ...report, start_date: null }
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("Configure la fecha de inicio del cuadre")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Ir a la configuración" })).toHaveAttribute("href", "/accounting/settings/rcv")
    })

    it("con fecha de inicio no muestra el aviso", () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.queryByText("Configure la fecha de inicio del cuadre")).not.toBeInTheDocument()
    })

    it("estado de carga", () => {
        m.report = undefined
        m.isLoading = true
        render(<FiscalReconciliationClientView />)
        expect(screen.getByLabelText("Cargando cuadre fiscal")).toBeInTheDocument()
    })

    it("estado de error con reintento", async () => {
        m.report = undefined
        m.isError = true
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("No se pudo cargar el cuadre fiscal")).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(m.refetch).toHaveBeenCalled()
    })

    it("estado vacío cuando el período no tiene documentos", () => {
        m.report = {
            start_date: "2026-10-01",
            documents: { purchase: { ONLY_ERP: 0 }, sale: { ONLY_ERP: 0 } },
            only_erp: [],
            summaries: report.summaries.map((s) => ({
                ...s, erp_count: 0, erp_total: "0", tuu_count: 0, tuu_total: "0", rcv_count: 0, rcv_total: "0", difference: "0",
            })),
            terminal: { ONLY_ERP: 0 },
        }
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("Sin documentos en el período")).toBeInTheDocument()
        expect(screen.queryByRole("heading", { name: "Boletas y comprobantes" })).not.toBeInTheDocument()
    })
})
