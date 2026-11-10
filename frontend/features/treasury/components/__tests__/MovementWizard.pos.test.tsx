import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MovementWizard } from "../MovementWizard"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }))
vi.mock("@/features/accounting", () => ({ accountingApi: { checkPeriodClosed: vi.fn() } }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-10" }) }))
vi.mock("@/hooks/usePeriodValidation", () => ({ usePeriodValidation: () => ({ validatePeriod: vi.fn() }) }))
vi.mock("@/components/selectors/TreasuryAccountSelector", () => ({ TreasuryAccountSelector: () => null }))
vi.mock("@/components/selectors/AdvancedContactSelector", () => ({ AdvancedContactSelector: () => null }))

function renderPosWizard() {
    return render(
        <MovementWizard
            open
            onOpenChange={vi.fn()}
            context="pos"
            fixedAccountId={7}
            fixedAccountName="Caja 1"
            maxOutboundAmount={50000}
            onComplete={vi.fn()}
            onCancel={vi.fn()}
        />,
    )
}

describe("MovementWizard en el POS", () => {
    it("llamar «Movimiento de Fondos» al asistente de la caja", () => {
        renderPosWizard()
        expect(screen.getByText("Movimiento de Fondos")).toBeTruthy()
    })

    it("en un depósito, elegir el motivo habilita «Siguiente» (la cuenta es la de la caja)", async () => {
        renderPosWizard()
        fireEvent.click(await screen.findByRole("button", { name: /Depósito/ }))
        fireEvent.click(await screen.findByRole("button", { name: "Propina" }))
        const next = await screen.findByRole("button", { name: /Siguiente/ })
        expect((next as HTMLButtonElement).disabled).toBe(false)
    })
})
