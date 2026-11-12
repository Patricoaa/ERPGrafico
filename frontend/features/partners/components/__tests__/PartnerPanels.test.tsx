import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner, PartnerOverview, PartnerTransaction } from "@/features/contacts"
import { PartnerSummaryPanel } from "../PartnerSummaryPanel"
import { PartnerCapitalPanel } from "../PartnerCapitalPanel"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { ReactElement } from "react"

const hooks = vi.hoisted(() => ({
    usePartnerOverview: vi.fn(),
    usePartnerStatement: vi.fn(),
    usePartnerStakes: vi.fn(),
}))
vi.mock("../../hooks", async (importOriginal) => ({ ...await importOriginal<typeof import("../../hooks")>(), ...hooks }))
vi.mock("@/features/contacts", () => ({ usePartners: () => ({ partners: [] }), netEquityPercentages: () => ({}) }))

const renderIn = (ui: ReactElement) => render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>)

const partner: Partner = {
    id: 7, name: "Ana Socia", tax_id: "1-9", partner_equity_percentage: "50",
    partner_total_contributions: "5000", partner_total_paid_in: "4000", partner_pending_capital: "1000",
    partner_excess_capital: "0", partner_provisional_withdrawals_balance: "0",
    partner_earnings_balance: "0", partner_dividends_payable_balance: "0", partner_net_equity: "4000",
}

const tx = (id: number, type: string, display: string): PartnerTransaction => ({
    id, partner: 7, partner_name: "Ana Socia", transaction_type: type, transaction_type_display: display,
    amount: "100", date: "2026-11-01", description: "", journal_entry_id: 1, journal_entry_display: "",
    created_by: 1, created_by_name: "x", created_at: "2026-11-01T10:00:00Z",
})

const overview: PartnerOverview = {
    alerts: [{ code: "pending_capital", severity: "warning", amount: "1000", target_tab: "capital", action: "contribution" }],
    kpis: { equity_percentage: "50", total_contributions: "5000", total_paid_in: "4000", pending_capital: "1000", excess_capital: "0", net_equity: "4000" },
    info: { partner_since: "2025-01-02", tax_id: "1-9", contact_id: 7 },
    composition: { capital: "4000", earnings_balance: "0", dividends_payable: "0", provisional_withdrawals: "0" },
}

const statement = (transactions: PartnerTransaction[]) => ({ data: { transactions }, isLoading: false, isError: false, refetch: vi.fn() })

beforeEach(() => {
    hooks.usePartnerOverview.mockReturnValue({ data: overview, isLoading: false, isError: false, refetch: vi.fn() })
    hooks.usePartnerStakes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.usePartnerStatement.mockReturnValue(statement([]))
})

describe("PartnerSummaryPanel", () => {
    it("la alerta solo tiene un botón que lleva a la pestaña Capital", async () => {
        const onGoToTab = vi.fn()
        renderIn(<PartnerSummaryPanel partner={partner} onGoToTab={onGoToTab} />)
        expect(screen.getByText(/Capital pendiente/)).toBeInTheDocument()
        const buttons = within(screen.getByRole("region", { name: "Alertas" })).getAllByRole("button")
        expect(buttons).toHaveLength(1)
        await userEvent.click(buttons[0])
        expect(onGoToTab).toHaveBeenCalledWith("capital")
    })
    it("empieza por los datos del socio (RUT) y no muestra tarjetas KPI", () => {
        hooks.usePartnerOverview.mockReturnValue({ data: { ...overview, alerts: [] }, isLoading: false, isError: false, refetch: vi.fn() })
        renderIn(<PartnerSummaryPanel partner={partner} onGoToTab={vi.fn()} />)
        expect(screen.queryByRole("region", { name: "Alertas" })).not.toBeInTheDocument()
        expect(screen.getByText("RUT")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Distribución de capital" })).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Participación histórica" })).toBeInTheDocument()
        expect(screen.queryByText("Capital suscrito")).not.toBeInTheDocument()
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerOverview.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        renderIn(<PartnerSummaryPanel partner={partner} onGoToTab={vi.fn()} />)
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(refetch).toHaveBeenCalled()
    })
})

describe("PartnerCapitalPanel", () => {
    it("cada línea de la composición ofrece su acción", async () => {
        const run = vi.fn()
        const p = { ...partner, partner_excess_capital: "50", partner_earnings_balance: "20", partner_dividends_payable_balance: "30" }
        renderIn(<PartnerCapitalPanel partner={p} run={run} />)
        await userEvent.click(screen.getByRole("button", { name: "Suscribir / reducir capital" }))
        expect(run).toHaveBeenLastCalledWith({ type: "subscription", partnerId: 7 })
        await userEvent.click(screen.getByRole("button", { name: "Registrar aporte" }))
        expect(run).toHaveBeenLastCalledWith({ type: "contribution", partnerId: 7, amount: "1000" })
        await userEvent.click(screen.getByRole("button", { name: "Formalizar exceso de capital" }))
        await userEvent.click(screen.getByRole("button", { name: "Distribuir utilidades retenidas" }))
        expect(run).toHaveBeenLastCalledWith({ type: "mobilize", partnerId: 7 })
        await userEvent.click(screen.getByRole("button", { name: "Pagar dividendos" }))
        expect(run).toHaveBeenLastCalledWith({ type: "dividend", partnerId: 7 })
        await userEvent.click(screen.getByRole("button", { name: "Registrar retiro" }))
        expect(run).toHaveBeenLastCalledWith({ type: "withdrawal", partnerId: 7 })
    })
    it("sin exceso, utilidades ni dividendos esas líneas no ofrecen acción", () => {
        renderIn(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        expect(screen.queryByRole("button", { name: "Formalizar exceso de capital" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Distribuir utilidades retenidas" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Pagar dividendos" })).not.toBeInTheDocument()
    })
    it("lista todos los movimientos salvo el seguimiento interno duplicado; transferir pide el origen", async () => {
        hooks.usePartnerStatement.mockReturnValue(statement([
            tx(1, "CAPITAL_CASH", "Aporte Efectivo UNICO"), tx(2, "PROV_WITHDRAWAL", "Retiro Provisorio X"),
            tx(3, "DIVIDEND_PAY", "Pago Dividendo Y"), tx(4, "CONTRIB_TRANSFER_IN", "Seguimiento interno Z"),
        ]))
        const run = vi.fn()
        renderIn(<PartnerCapitalPanel partner={partner} run={run} />)
        expect(screen.getByText("Aporte Efectivo UNICO")).toBeInTheDocument()
        expect(screen.getByText("Retiro Provisorio X")).toBeInTheDocument()
        expect(screen.getByText("Pago Dividendo Y")).toBeInTheDocument()
        expect(screen.queryByText("Seguimiento interno Z")).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Transferir capital" }))
        expect(run).toHaveBeenCalledWith({ type: "transfer", fromPartnerId: 7 })
    })
    it("empty sin movimientos", () => {
        renderIn(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Sin movimientos")).toBeInTheDocument()
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerStatement.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        renderIn(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        await userEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0])
        expect(refetch).toHaveBeenCalled()
    })
})
