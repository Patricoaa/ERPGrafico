import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner, PartnerOverview, PartnerTransaction } from "@/features/contacts"
import { PartnerSummaryPanel } from "../PartnerSummaryPanel"
import { PartnerCapitalPanel } from "../PartnerCapitalPanel"
import { PartnerResultsPanel } from "../PartnerResultsPanel"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { CAPITAL_MOVEMENT_TYPES, RESULTS_MOVEMENT_TYPES, OMITTED_MOVEMENT_TYPES } from "../../entity-view/partnerMovement.entity"

const hooks = vi.hoisted(() => ({
    usePartnerOverview: vi.fn(),
    usePartnerStatement: vi.fn(),
    usePartnerStakes: vi.fn(),
}))
vi.mock("../../hooks", () => hooks)

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
    it("muestra la alerta del backend y su botón pide la acción con el importe", async () => {
        const run = vi.fn(); const onGoToTab = vi.fn()
        render(<PartnerSummaryPanel partner={partner} run={run} onGoToTab={onGoToTab} />)
        expect(screen.getByText(/Capital pendiente/)).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Pagar capital" }))
        expect(run).toHaveBeenCalledWith({ type: "contribution", partnerId: 7, amount: "1000" })
        await userEvent.click(screen.getByRole("button", { name: /^Ver/ }))
        expect(onGoToTab).toHaveBeenCalledWith("capital")
    })
    it("sin alertas no renderiza la sección", () => {
        hooks.usePartnerOverview.mockReturnValue({ data: { ...overview, alerts: [] }, isLoading: false, isError: false, refetch: vi.fn() })
        render(<PartnerSummaryPanel partner={partner} run={vi.fn()} onGoToTab={vi.fn()} />)
        expect(screen.queryByRole("region", { name: "Alertas" })).not.toBeInTheDocument()
        expect(screen.getAllByText("Patrimonio neto").length).toBeGreaterThan(0)
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerOverview.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        render(<PartnerSummaryPanel partner={partner} run={vi.fn()} onGoToTab={vi.fn()} />)
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(refetch).toHaveBeenCalled()
    })
})

describe("PartnerCapitalPanel", () => {
    it("solo movimientos de capital y transferir pide la acción con el origen", async () => {
        hooks.usePartnerStatement.mockReturnValue(statement([tx(1, "CAPITAL_CASH", "Aporte Efectivo UNICO"), tx(2, "PROV_WITHDRAWAL", "Retiro Provisorio X")]))
        const run = vi.fn()
        render(<PartnerCapitalPanel partner={partner} run={run} />)
        expect(screen.getByText("Aporte Efectivo UNICO")).toBeInTheDocument()
        expect(screen.queryByText("Retiro Provisorio X")).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Transferir a otro socio" }))
        expect(run).toHaveBeenCalledWith({ type: "transfer", fromPartnerId: 7 })
    })
    it("empty sin movimientos", () => {
        render(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Sin movimientos de capital")).toBeInTheDocument()
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerStatement.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        render(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        await userEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0])
        expect(refetch).toHaveBeenCalled()
    })
})

describe("PartnerResultsPanel", () => {
    it("muestra retiros y dividendos, no aportes", () => {
        hooks.usePartnerStatement.mockReturnValue(statement([tx(1, "CAPITAL_CASH", "Aporte Efectivo UNICO"), tx(2, "PROV_WITHDRAWAL", "Retiro Provisorio X"), tx(3, "DIVIDEND_PAY", "Pago Dividendo Y")]))
        render(<PartnerResultsPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Retiro Provisorio X")).toBeInTheDocument()
        expect(screen.getByText("Pago Dividendo Y")).toBeInTheDocument()
        expect(screen.queryByText("Aporte Efectivo UNICO")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Registrar retiro" })).toBeInTheDocument()
    })
    it("el filtro por tipo acota los movimientos", async () => {
        hooks.usePartnerStatement.mockReturnValue(statement([tx(2, "PROV_WITHDRAWAL", "Retiro Provisorio X"), tx(3, "DIVIDEND_PAY", "Pago Dividendo Y")]))
        render(<PartnerResultsPanel partner={partner} run={vi.fn()} />)
        await userEvent.click(screen.getByRole("button", { name: "Dividendos" }))
        expect(screen.queryByText("Retiro Provisorio X")).not.toBeInTheDocument()
        expect(screen.getByText("Pago Dividendo Y")).toBeInTheDocument()
    })
    it("empty sin movimientos", () => {
        render(<PartnerResultsPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Sin movimientos de resultados")).toBeInTheDocument()
    })
    it("error con reintento", async () => {
        const refetch = vi.fn()
        hooks.usePartnerStatement.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
        render(<PartnerResultsPanel partner={partner} run={vi.fn()} />)
        await userEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0])
        expect(refetch).toHaveBeenCalled()
    })
})

describe("clasificación de movimientos", () => {
    it("CAPITAL_RETURN va a Capital y no a Resultados; LOSS_ABSORB al revés", () => {
        hooks.usePartnerStatement.mockReturnValue(statement([tx(1, "CAPITAL_RETURN", "Devolución UNICA"), tx(2, "LOSS_ABSORB", "Absorción UNICA")]))
        const cap = render(<PartnerCapitalPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Devolución UNICA")).toBeInTheDocument()
        expect(screen.queryByText("Absorción UNICA")).not.toBeInTheDocument()
        cap.unmount()
        render(<PartnerResultsPanel partner={partner} run={vi.fn()} />)
        expect(screen.getByText("Absorción UNICA")).toBeInTheDocument()
        expect(screen.queryByText("Devolución UNICA")).not.toBeInTheDocument()
    })
    it("todo tipo del backend está en capital, resultados u omitidos (y sin duplicados)", () => {
        const file = resolve(process.cwd(), "../backend/contacts/partner_models.py")
        if (!existsSync(file)) return
        const src = readFileSync(file, "utf8")
        const block = src.slice(src.indexOf("class Type(models.TextChoices)"), src.indexOf("partner = models.ForeignKey"))
        const backendTypes = [...block.matchAll(/=\s*"([A-Z_]+)",\s*_\(/g)].map(m => m[1])
        expect(backendTypes.length).toBeGreaterThan(15)
        const all = [...CAPITAL_MOVEMENT_TYPES, ...RESULTS_MOVEMENT_TYPES, ...OMITTED_MOVEMENT_TYPES]
        expect(backendTypes.filter(t => !all.includes(t))).toEqual([])
        expect(new Set(all).size).toBe(all.length)
    })
})
