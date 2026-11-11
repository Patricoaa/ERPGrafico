import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SessionCashSummary } from "../SessionCashSummary"
import type { POSReportData } from "../POSReport"

const downloadPdf = vi.fn<(id: number, type: "X" | "Z") => Promise<void>>()
vi.mock("../../hooks/usePOSSessions", () => ({ useDownloadPOSReportPDF: () => ({ downloadPdf }) }))

const data = {
    session_id: 4, opening_balance: 10000, total_cash_sales: 15000, total_card_sales: 8000,
    total_transfer_sales: 0, total_credit_sales: 0, total_check_sales: 0, total_sales: 23000,
    expected_cash: 22000, total_manual_inflow: 0, total_manual_outflow: 3000, sale_order_count: 3,
} as POSReportData

describe("SessionCashSummary", () => {
    it("explica el esperado: fondo, líneas con movimiento y total", () => {
        render(<SessionCashSummary data={data} expected={22000} sessionId={4} />)
        expect(screen.getByText("Fondo inicial")).toBeTruthy()
        expect(screen.getByText("+ Efectivo de ventas")).toBeTruthy()
        expect(screen.getByText("− Retiros y gastos")).toBeTruthy()
        // Las líneas en cero no se muestran
        expect(screen.queryByText(/Depósitos manuales/)).toBeNull()
        expect(screen.getByText("$22.000")).toBeTruthy()
        expect(screen.getByText(/3 ventas/)).toBeTruthy()
    })

    it("solo exporta a PDF (sin imprimir) el informe Z de la sesión", async () => {
        downloadPdf.mockResolvedValue()
        render(<SessionCashSummary data={data} expected={22000} sessionId={4} />)
        expect(screen.queryByRole("button", { name: /Imprimir/i })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: /PDF/ }))
        await waitFor(() => expect(downloadPdf).toHaveBeenCalledWith(4, "Z"))
    })
})
