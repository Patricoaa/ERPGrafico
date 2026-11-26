import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MobilizeEarningsWizard } from "../MobilizeEarningsWizard"

// Stable like the query cache: the wizard resets its draft whenever the partner list changes.
const PARTNERS = [{ id: 7, name: "Ana Rojas", partner_earnings_balance: "1000" }]
vi.mock("@/features/contacts", () => ({ usePartners: () => ({ partners: PARTNERS }) }))
vi.mock("../../hooks", () => ({ usePartnerMutations: () => ({ mobilizeRetainedEarnings: { mutateAsync: vi.fn() } }) }))
vi.mock("@/hooks/usePeriodValidation", () => ({
    usePeriodValidation: () => ({ validatePeriod: vi.fn(), validatePeriodImmediate: vi.fn(), clearPeriodValidation: vi.fn(), isValidating: false, isClosed: false, message: null }),
}))

describe("MobilizeEarningsWizard on EditableCollection", () => {
    it("caps each amount and their sum by the partner's retained balance", () => {
        render(<MobilizeEarningsWizard open onOpenChange={vi.fn()} />)
        const table = screen.getByRole("table", { name: "Montos a movilizar por socio" })

        fireEvent.change(within(table).getByRole("spinbutton", { name: "A dividendos — Ana Rojas" }), { target: { value: "700" } })
        expect(within(table).queryByRole("alert")).toBeNull()

        fireEvent.change(within(table).getByRole("spinbutton", { name: "A reinversión — Ana Rojas" }), { target: { value: "400" } })
        expect(within(table).getByRole("alert")).toHaveTextContent("La suma supera lo disponible")
    })
})
