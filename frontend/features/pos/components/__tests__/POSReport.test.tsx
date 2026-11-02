import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { POSReport, type POSReportData } from "../POSReport"

vi.mock("@/contexts/BrandingProvider", () => ({ useBranding: () => ({ logo: null }) }))
vi.mock("../../hooks/usePOSSessions", () => ({ useDownloadPOSReportPDF: () => ({ downloadPdf: vi.fn() }) }))

const base: POSReportData = {
    session_id: 7,
    opening_balance: 100000,
    total_cash_sales: 50000,
    total_card_sales: 0,
    total_transfer_sales: 0,
    total_credit_sales: 0,
    total_check_sales: 0,
    total_sales: 50000,
    expected_cash: 120000,
    total_manual_inflow: 0,
    total_manual_outflow: 0,
}

describe("POSReport cash ledger (ADR-0109)", () => {
    it("shows out-of-session movements and the server expected cash", () => {
        render(
            <POSReport
                data={{
                    ...base,
                    cash_ledger_mode: true,
                    cash_breakdown: {
                        cash_sales: 50000,
                        cash_refunds: 0,
                        manual_inflow: 0,
                        manual_outflow: 0,
                        external_inflow: 0,
                        external_outflow: 30000,
                        annulments: 0,
                        net: 20000,
                    },
                    out_of_session_movements: [
                        {
                            id: 1,
                            display_id: "MOV-1",
                            event: "EXTERNAL",
                            direction: "OUT",
                            amount: 30000,
                            at: "2026-11-01T10:00:00",
                            document: "OC-5",
                            contact_name: "",
                            notes: "",
                            reason: "Pago a proveedor",
                            created_by_name: "Contador",
                        },
                    ],
                }}
            />
        )

        expect(screen.getByText("(-) Egresos fuera de la sesión:")).toBeInTheDocument()
        expect(screen.getByText("Fuera de la Sesión")).toBeInTheDocument()
        expect(screen.getByText(/MOV-1 · OC-5/)).toBeInTheDocument()
        expect(screen.getByText("Contador — Pago a proveedor")).toBeInTheDocument()
        expect(screen.getByText(/120\.000/)).toBeInTheDocument()
    })

    it("keeps legacy sessions without the out-of-session section", () => {
        render(<POSReport data={{ ...base, cash_ledger_mode: false, cash_breakdown: null }} />)
        expect(screen.queryByText("Fuera de la Sesión")).not.toBeInTheDocument()
    })
})
