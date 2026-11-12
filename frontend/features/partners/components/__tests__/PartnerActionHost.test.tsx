import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner } from "@/features/contacts"
import { PartnerActionHost } from "../PartnerActionHost"
import { demoteBlockedReason } from "../partnerActions"

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

describe("PartnerActionHost", () => {
    it("confirma y da de baja al socio, avisando a quien lo monta", async () => {
        demote.mockResolvedValue({})
        const onDemoted = vi.fn()
        render(<PartnerActionHost request={{ type: "demote", partnerId: 1 }} onClose={vi.fn()} onDemoted={onDemoted} />)

        expect(screen.getByText(/Ana Socia/)).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /Dar de baja/ }))

        await waitFor(() => expect(demote).toHaveBeenCalledWith(1))
        await waitFor(() => expect(onDemoted).toHaveBeenCalledWith(1))
    })

    it("no monta ninguna confirmación sin petición activa", () => {
        render(<PartnerActionHost request={null} onClose={vi.fn()} />)
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
