import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { LedgerSummaryPanel } from "../LedgerSummaryPanel"

const PROPS = {
    openingBalance: 1000,
    periodDebit: 250.5,
    periodCredit: 75,
    closingBalance: 1175.5,
    fromDate: new Date(2026, 0, 1),
    toDate: new Date(2026, 0, 31),
}

describe("LedgerSummaryPanel", () => {
    it("renders the four ledger figures", () => {
        render(<LedgerSummaryPanel {...PROPS} />)
        for (const label of ["Saldo Inicial", "Cargos (Debe)", "Abonos (Haber)", "Saldo Final"]) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
    })

    it("carries the CMYK ink as cue icons", () => {
        const { container } = render(<LedgerSummaryPanel {...PROPS} />)
        expect(container.querySelector(".lucide-calculator")).toBeInTheDocument()
        expect(container.querySelector(".lucide-arrow-up-right")).toBeInTheDocument()
        expect(container.querySelector(".lucide-arrow-down-right")).toBeInTheDocument()
        expect(container.querySelector(".lucide-scale")).toBeInTheDocument()
    })

    it("keeps labels legible: text-foreground, never the fixed ink", () => {
        render(<LedgerSummaryPanel {...PROPS} />)
        for (const label of ["Saldo Inicial", "Cargos (Debe)", "Abonos (Haber)", "Saldo Final"]) {
            const el = screen.getByText(label)
            expect(el.className).toContain("text-foreground")
            expect(el.className).not.toMatch(/text-(cyan|magenta|yellow)/)
        }
    })

    it("shows the period edges as dates", () => {
        render(<LedgerSummaryPanel {...PROPS} />)
        expect(screen.getByText("Al 01/01/26")).toBeInTheDocument()
        expect(screen.getByText("Al 31/01/26")).toBeInTheDocument()
    })
})
