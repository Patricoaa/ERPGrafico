import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Step2_DTE } from "../Step2_DTE"
import type { CheckoutDTEData } from "../../../types"

vi.mock("@/features/settings", () => ({ useBillingSettingsQuery: () => ({ settings: undefined }) }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-15" }) }))

describe("Step2_DTE", () => {
    it("la opción boleta avisa que con terminal integrado se emite automáticamente (ADR-0140)", () => {
        const dteData = { type: "BOLETA" } as CheckoutDTEData
        render(<Step2_DTE dteData={dteData} setDteData={vi.fn()} />)
        expect(
            screen.getByText("Consumidor final. Si se cobra con terminal integrado se emite automáticamente con folio SII o TUU.")
        ).toBeTruthy()
    })
})
