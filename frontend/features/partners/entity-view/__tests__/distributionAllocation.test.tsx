import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { EditableCollection, editableSchema, type EditableRowValue } from "@/components/entity-view"
import { distributionAllocationEditable, remainingOf, type DistributionPartnerRow } from "../distributionPartner.entity"

const row = (over: Partial<DistributionPartnerRow>): DistributionPartnerRow => ({
    id: 1, partnerId: 1, partnerName: "Ana", percentageBefore: 60, gross: 1000, offset: 0, net: 1000,
    dividend: 0, reinvest: 0, retained: 0, loss: 0, ...over,
})
const ROWS = [
    row({}),
    row({ id: 2, partnerName: "Beto", percentageBefore: 40, gross: 600, offset: 600, net: 0 }),
]
const value = (ana: { dividend: number; reinvest: number; retained: number }): EditableRowValue[] => [
    { key: "1", values: ana },
    { key: "2", values: { dividend: 0, reinvest: 0, retained: 0 } },
]
const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement

describe("distributionAllocationEditable (CreateDistributionWizard)", () => {
    it("says what is missing, balanced or over in the row status", () => {
        const { rerender } = render(<EditableCollection definition={distributionAllocationEditable} rows={ROWS} value={value({ dividend: 600, reinvest: 0, retained: 0 })} onChange={() => {}} label="Destino" />)
        expect(within(rowOf("Ana")).getByText(/^Faltan /)).toBeInTheDocument()

        rerender(<EditableCollection definition={distributionAllocationEditable} rows={ROWS} value={value({ dividend: 600, reinvest: 400, retained: 0 })} onChange={() => {}} label="Destino" />)
        expect(within(rowOf("Ana")).getByText("Cuadra")).toBeInTheDocument()

        rerender(<EditableCollection definition={distributionAllocationEditable} rows={ROWS} value={value({ dividend: 900, reinvest: 400, retained: 0 })} onChange={() => {}} label="Destino" />)
        expect(within(rowOf("Ana")).getByText(/^Excede /)).toBeInTheDocument()
    })

    it("leaves fully compensated partners out, with the reason under the name", () => {
        render(<EditableCollection definition={distributionAllocationEditable} rows={ROWS} value={value({ dividend: 0, reinvest: 0, retained: 0 })} onChange={() => {}} label="Destino" />)
        expect(within(rowOf("Beto")).getByText("Los retiros compensan toda la utilidad bruta")).toBeInTheDocument()
        expect(screen.getByRole("spinbutton", { name: "Dividendos — Beto" })).toBeDisabled()
    })

    it("caps each destination by the net and computes the remainder", () => {
        expect(remainingOf(ROWS[0], { dividend: 250, reinvest: 250, retained: 0 })).toBe(500)
        const parsed = editableSchema(distributionAllocationEditable, ROWS).safeParse(value({ dividend: 1200, reinvest: 0, retained: 0 }))
        expect(parsed.success).toBe(false)
    })
})
