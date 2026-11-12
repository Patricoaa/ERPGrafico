import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner } from "@/features/contacts"
import { PartnerActionModal } from "../PartnerActionModal"
import { demoteBlockedReason } from "../partnerActions"
import { resolvePartnerTransactionDocument } from "../partnerTransactionActions"

const demote = vi.fn()

const base: Partner = {
    id: 1, name: "Ana Socia", tax_id: "1-9", partner_equity_percentage: "50",
    partner_total_contributions: "0", partner_total_paid_in: "0", partner_pending_capital: "0",
    partner_excess_capital: "0", partner_provisional_withdrawals_balance: "0",
    partner_earnings_balance: "0", partner_dividends_payable_balance: "0", partner_net_equity: "0",
}

vi.mock("@/features/contacts", () => ({ usePartners: () => ({ partners: [base] }) }))
vi.mock("../../hooks", () => ({ usePartnerMutations: () => ({ demotePartner: { mutateAsync: (...a: unknown[]): unknown => demote(...a) } }) }))
vi.mock("../AddPartnerModal", () => ({ AddPartnerModal: () => null }))
vi.mock("../EquityMovementModals", () => ({ DividendPaymentModal: () => null, EquityTransferModal: () => null, SubscriptionMovementModal: () => null }))
vi.mock("../MobilizeEarningsWizard", () => ({ MobilizeEarningsWizard: () => null }))
vi.mock("../PartnerContributionWizard", () => ({ PartnerContributionWizard: () => null }))
vi.mock("../PartnerWithdrawalWizard", () => ({ PartnerWithdrawalWizard: () => null }))

beforeEach(() => vi.clearAllMocks())

describe("PartnerActionModal", () => {
    it("confirma y da de baja al socio, avisando a quien lo monta", async () => {
        demote.mockResolvedValue({})
        const onDemoted = vi.fn()
        render(<PartnerActionModal request={{ type: "demote", partnerId: 1 }} onClose={vi.fn()} onDemoted={onDemoted} />)

        expect(screen.getByText(/Ana Socia/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /Dar de baja/ }))

        await waitFor(() => expect(demote).toHaveBeenCalledWith(1))
        await waitFor(() => expect(onDemoted).toHaveBeenCalledWith(1))
    })

    it("no monta ninguna confirmación sin petición activa", () => {
        render(<PartnerActionModal request={null} onClose={vi.fn()} />)
        expect(screen.queryByRole("button", { name: /Dar de baja/ })).toBeNull()
    })
})

describe("demoteBlockedReason", () => {
    it("permite la baja solo sin capital ni saldos", () => {
        expect(demoteBlockedReason(base)).toBeNull()
    })
    it.each([
        ["partner_total_contributions", /capital suscrito/],
        ["partner_provisional_withdrawals_balance", /retiros provisorios/],
        ["partner_earnings_balance", /utilidades/],
        ["partner_dividends_payable_balance", /dividendos/],
    ] as const)("la bloquea si %s > 0", (field, reason) => {
        expect(demoteBlockedReason({ ...base, [field]: "10" })).toMatch(reason)
    })
})

describe("resolvePartnerTransactionDocument", () => {
    const tx = { id: 1, partner: 1, partner_name: "A", transaction_type: "CAPITAL_CASH", transaction_type_display: "", amount: "1", date: "2026-01-01", description: "", journal_entry_id: 9, journal_entry_display: "", created_by: 1, created_by_name: "", created_at: "" }

    it("prioriza bienes > tesorería > resolución > asiento", () => {
        expect(resolvePartnerTransactionDocument({ ...tx, stock_move: 5, treasury_movement: 6, distribution_resolution: 7 })).toEqual({ label: "inventory.stockmove", id: 5 })
        expect(resolvePartnerTransactionDocument({ ...tx, treasury_movement: 6, distribution_resolution: 7 })).toEqual({ label: "treasury.treasurymovement", id: 6 })
        expect(resolvePartnerTransactionDocument({ ...tx, distribution_resolution: 7 })).toEqual({ label: "contacts.profitdistributionresolution", id: 7 })
        expect(resolvePartnerTransactionDocument(tx)).toEqual({ label: "accounting.journalentry", id: 9 })
    })
    it("devuelve null sin respaldo", () => {
        expect(resolvePartnerTransactionDocument({ ...tx, journal_entry_id: 0 })).toBeNull()
    })
})
