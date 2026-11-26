import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CashFlowTable, type CashFlowData } from "../CashFlowTable"

const data: CashFlowData = {
    operating: [{ name: "Cobros a clientes", amount: 900 }, { name: "Pagos a proveedores", amount: -300 }],
    total_operating: 600,
    investing: [{ name: "Compra de equipos", amount: -200 }],
    total_investing: -200,
    financing: [{ name: "Préstamo recibido", amount: 100 }],
    total_financing: 100,
    beginning_cash: 1000,
    ending_cash: 1450,
    net_increase: 450,
    calculated_net_increase: 500,
    discrepancy: -50,
    is_balanced: false,
    culprit_accounts: [{ code: "1.1.05", name: "Fondos por rendir", variation: -50, type: "ASSET" }],
}

describe("CashFlowTable on entity-view", () => {
    afterEach(() => vi.restoreAllMocks())

    it("renders activity lines numbered per activity without duplicate row keys", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        render(<CashFlowTable data={data} embedded />)
        // Every activity numbers its lines from 0: the row key must still be unique.
        expect(screen.getByText("Cobros a clientes")).toBeInTheDocument()
        expect(screen.getByText("Compra de equipos")).toBeInTheDocument()
        expect(screen.getByText("Préstamo recibido")).toBeInTheDocument()
        expect(error.mock.calls.some(([msg]) => String(msg).includes("same key"))).toBe(false)
    })

    it("lists future maturities and the unmapped accounts of the audit", async () => {
        render(
            <CashFlowTable
                data={data}
                embedded
                futureMaturities={[
                    { type: "LOAN_INSTALLMENT", direction: "OUTBOUND", label: "Cuota 3/12", due_date: "2026-12-05", amount: 120 },
                    { type: "CHECK_RECEIVED", direction: "INBOUND", label: "Cheque 4411", due_date: "2026-12-05", amount: 80 },
                ]}
            />,
        )
        const maturities = screen.getByText("Cuota 3/12").closest("table") as HTMLElement
        expect(within(maturities).getByText("Cuota")).toBeInTheDocument()
        expect(within(maturities).getByText("Cheque recibido")).toBeInTheDocument()

        await userEvent.click(screen.getByRole("button", { name: "Auditar Diferencia" }))
        expect(await screen.findByText("Fondos por rendir")).toBeInTheDocument()
        expect(screen.getByText("1.1.05")).toBeInTheDocument()
    })
})
