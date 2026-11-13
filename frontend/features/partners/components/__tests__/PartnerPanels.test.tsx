import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner, PartnerEquityStake, PartnerOverview, PartnerTransaction } from "@/features/contacts"
import { PartnerSummaryPanel } from "../PartnerSummaryPanel"
import { PartnerCapitalPanel } from "../PartnerCapitalPanel"
import { PartnerCapitalMovementsPanel } from "../PartnerCapitalMovementsPanel"
import { participationSeries, participationAxisFormat, PartnerParticipationHistory } from "../PartnerParticipationHistory"
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

const stake = (id: number, percentage: string, from: string, until: string | null): PartnerEquityStake => ({
    id, partner: 7, partner_name: "Ana Socia", percentage, effective_from: from, effective_until: until,
    is_active: until === null, source_transaction: null, notes: "", created_at: `${from}T10:00:00Z`,
})

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
        const datos = screen.getByRole("region", { name: "Datos del socio" })
        expect(within(datos).getByText("RUT")).toBeInTheDocument()
        expect(within(datos).getByText("Socio desde")).toBeInTheDocument()
        expect(within(datos).getByRole("region", { name: "Distribución de capital" })).toBeInTheDocument()
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

describe("PartnerParticipationHistory", () => {
    it("arma la serie con un punto por cambio y uno de cierre en la última fecha", () => {
        const series = participationSeries([
            stake(1, "50", "2024-03-01", "2025-06-30"),
            stake(2, "60", "2025-07-01", null),
        ], "2026-02-10")
        expect(series).toEqual([
            { x: "2024-03-01", y: 50 },
            { x: "2025-07-01", y: 60 },
            { x: "2026-02-10", y: 60 },
        ])
    })
    it("el rango de la serie define el formato del eje", () => {
        const at = (from: string, to: string) => [{ x: from, y: 1 }, { x: to, y: 1 }]
        expect(participationAxisFormat(at("2026-01-01", "2026-03-01"))).toEqual({ day: "2-digit", month: "short" })
        expect(participationAxisFormat(at("2024-01-01", "2026-03-01"))).toEqual({ month: "short", year: "2-digit" })
        expect(participationAxisFormat(at("2015-01-01", "2026-03-01"))).toEqual({ year: "numeric" })
    })
    it("sin vigencias no hay serie y muestra el aviso", () => {
        expect(participationSeries([])).toEqual([])
        renderIn(<PartnerParticipationHistory partnerId={7} />)
        expect(screen.getByText(/aún no tiene evolución registrada/)).toBeInTheDocument()
    })
    it("con más de un ejercicio dibuja la evolución", () => {
        hooks.usePartnerStakes.mockReturnValue({
            data: [stake(1, "50", "2024-03-01", "2025-06-30"), stake(2, "60", "2025-07-01", null)],
            isLoading: false, isError: false, refetch: vi.fn(),
        })
        renderIn(<PartnerParticipationHistory partnerId={7} />)
        expect(screen.getByRole("img", { name: /Evolución de la participación: 01\/03\/2024 50%/ })).toBeInTheDocument()
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
    it("transferir capital está en la fila de Patrimonio neto y pide el origen", async () => {
        const run = vi.fn()
        renderIn(<PartnerCapitalPanel partner={partner} run={run} />)
        await userEvent.click(screen.getByRole("button", { name: "Transferir capital" }))
        expect(run).toHaveBeenCalledWith({ type: "transfer", fromPartnerId: 7 })
    })
    it("no dibuja el gráfico de composición", () => {
        renderIn(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
})

describe("PartnerCapitalMovementsPanel", () => {
    it("lista todos los movimientos salvo el seguimiento interno duplicado", () => {
        hooks.usePartnerStatement.mockReturnValue(statement([
            tx(1, "CAPITAL_CASH", "Aporte Efectivo UNICO"), tx(2, "PROV_WITHDRAWAL", "Retiro Provisorio X"),
            tx(3, "DIVIDEND_PAY", "Pago Dividendo Y"), tx(4, "CONTRIB_TRANSFER_IN", "Seguimiento interno Z"),
        ]))
        renderIn(<PartnerCapitalMovementsPanel partner={partner} />)
        expect(screen.getByText("Aporte Efectivo UNICO")).toBeInTheDocument()
        expect(screen.getByText("Retiro Provisorio X")).toBeInTheDocument()
        expect(screen.getByText("Pago Dividendo Y")).toBeInTheDocument()
        expect(screen.queryByText("Seguimiento interno Z")).not.toBeInTheDocument()
    })
    it("empty sin movimientos", () => {
        renderIn(<PartnerCapitalMovementsPanel partner={partner} />)
        expect(screen.getByText("Sin movimientos")).toBeInTheDocument()
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerStatement.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        renderIn(<PartnerCapitalMovementsPanel partner={partner} />)
        await userEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0])
        expect(refetch).toHaveBeenCalled()
    })
})
