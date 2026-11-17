import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FiscalReconciliationReport } from "../../types/reconciliation"
import { matchStatusValue } from "@/lib/fiscal-match"

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
        { dte_type: 39, erp_count: 2, erp_total: "3000.00", tuu_count: 2, tuu_total: "3000.00", rcv_count: 2, rcv_total: "2500.00", difference: "500.00", tuu_without_rcv: 3, rcv_without_tuu: 4 },
        { dte_type: 41, erp_count: 0, erp_total: "0", tuu_count: 0, tuu_total: "0", rcv_count: 0, rcv_total: "0", difference: "0", tuu_without_rcv: 0, rcv_without_tuu: 0 },
        { dte_type: 48, erp_count: 5, erp_total: "25000.00", tuu_count: 5, tuu_total: "25000.00", rcv_count: 0, rcv_total: "0", difference: "25000.00", tuu_without_rcv: null, rcv_without_tuu: null },
    ],
    terminal: { MATCHED: 30, AMBIGUOUS: 1, ONLY_EXTERNAL: 2, ONLY_ERP: 1 },
    pending_issue: {
        count: 4,
        items: [
            { id: 901, label: "Boleta Electrónica sin folio (#901)", amount: "1500", date: "2026-10-03", reason: "NO_TUU", error: null },
            { id: 902, label: "Boleta Electrónica sin folio (#902)", amount: "2500", date: "2026-10-04", reason: "WAITING_RCV", error: null },
            { id: 903, label: "Comprobante de Pago sin folio (#903)", amount: "3500", date: "2026-10-05", reason: "ERROR", error: "Período cerrado" },
            { id: 904, label: "Comprobante de Pago sin folio (#904)", amount: "4500", date: "2026-10-06", reason: "READY", error: null },
        ],
    },
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

    it("Boletas y comprobantes: boletas sin par entre TUU y el SII; guion en el 48", () => {
        render(<FiscalReconciliationClientView />)
        const table = screen.getByRole("table", { name: "Boletas y comprobantes" })
        const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent)
        expect(headers).toEqual(expect.arrayContaining(["Venta TUU sin boleta SII", "Boleta SII sin venta TUU"]))
        const rows = within(table).getAllByRole("row")
        const boleta = rows.find((r) => within(r).queryByText("39 · Boleta Electrónica"))
        const comprobante = rows.find((r) => within(r).queryByText("48 · Comprobante de pago electrónico"))
        expect(boleta && within(boleta).getByText("3")).toBeInTheDocument()
        expect(boleta && within(boleta).getByText("4")).toBeInTheDocument()
        expect(comprobante && within(comprobante).getAllByText("—").length).toBe(2)
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

    it("sin importación RCV de la dirección, «Falta en el SII» muestra «—» sin enlace", () => {
        m.report = { ...report, documents: { ...report.documents, purchase: { MATCHED: 12, ONLY_ERP: null } } }
        render(<FiscalReconciliationClientView />)
        const purchases = screen.getByRole("heading", { name: "Compras" }).closest("section") as HTMLElement
        const row = within(purchases).getByText(matchStatusValue("ONLY_ERP").label).closest("li") as HTMLElement
        expect(within(row).getByText("—")).toBeInTheDocument()
        expect(within(purchases).queryByText("0")).not.toBeInTheDocument()
        expect(within(purchases).getAllByRole("link")).toHaveLength(1) // solo «Cuadrado»
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
            pending_issue: { count: 0, items: [] },
        }
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("Sin documentos en el período")).toBeInTheDocument()
        expect(screen.queryByRole("heading", { name: "Boletas y comprobantes" })).not.toBeInTheDocument()
    })

    it("Boletas pendientes de folio: conteo, motivo y abre el borrador", async () => {
        render(<FiscalReconciliationClientView />)
        expect(screen.getByRole("heading", { name: "Boletas pendientes de folio" })).toBeInTheDocument()
        expect(screen.getByText("4 borradores esperan su número fiscal.")).toBeInTheDocument()
        const table = screen.getByRole("table", { name: "Boletas pendientes de folio" })
        const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent)
        expect(headers).toEqual(expect.arrayContaining(["Documento", "Fecha", "Monto", "Motivo", "Detalle"]))
        expect(within(table).getByText("Sin venta TUU")).toBeInTheDocument()
        expect(within(table).getByText("Esperando RCV")).toBeInTheDocument()
        expect(within(table).getByText("Error al emitir: Período cerrado")).toBeInTheDocument()
        expect(within(table).getByTitle("Período cerrado")).toBeInTheDocument()
        expect(within(table).getByText("Lista para emitir")).toBeInTheDocument()
        await userEvent.click(within(table).getByRole("button", { name: /#902/ }))
        expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 902)
    })

    it("Boletas pendientes de folio: un error largo se acorta en el motivo y se lee completo en el detalle", () => {
        const error = "El período contable de octubre de 2026 está cerrado y no admite asientos nuevos"
        m.report = {
            ...report,
            pending_issue: { count: 1, items: [{ id: 905, label: "Boleta Electrónica sin folio (#905)", amount: "100", date: "2026-10-07", reason: "ERROR", error }] },
        }
        render(<FiscalReconciliationClientView />)
        const table = screen.getByRole("table", { name: "Boletas pendientes de folio" })
        expect(within(table).getByText(`Error al emitir: ${error.slice(0, 40).trimEnd()}…`)).toBeInTheDocument()
        expect(within(table).getByTitle(error)).toHaveTextContent(error)
    })

    it("Boletas pendientes de folio: estado vacío", () => {
        m.report = { ...report, pending_issue: { count: 0, items: [] } }
        render(<FiscalReconciliationClientView />)
        expect(screen.getByText("No hay boletas pendientes de folio")).toBeInTheDocument()
    })

    it("un período solo con boletas pendientes no se muestra vacío", () => {
        m.report = {
            start_date: "2026-10-01",
            documents: { purchase: { ONLY_ERP: 0 }, sale: { ONLY_ERP: 0 } },
            only_erp: [],
            summaries: report.summaries.map((s) => ({
                ...s, erp_count: 0, erp_total: "0", tuu_count: 0, tuu_total: "0", rcv_count: 0, rcv_total: "0", difference: "0",
            })),
            terminal: { ONLY_ERP: 0 },
            pending_issue: report.pending_issue,
        }
        render(<FiscalReconciliationClientView />)
        expect(screen.queryByText("Sin documentos en el período")).not.toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Boletas pendientes de folio" })).toBeInTheDocument()
    })
})
