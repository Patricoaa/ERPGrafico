import { describe, expect, it } from "vitest"
import type { TaxPeriod } from "../../types"
import { deriveF29Phase } from "../f29Phase"

type PeriodInput = Pick<TaxPeriod, "status" | "declaration_summary">

const summary = (
    overrides: Partial<NonNullable<TaxPeriod["declaration_summary"]>> = {},
): NonNullable<TaxPeriod["declaration_summary"]> => ({
    id: 1,
    vat_to_pay: 1000,
    total_paid: 0,
    is_fully_paid: false,
    ...overrides,
})

const period = (overrides: Partial<PeriodInput> = {}): PeriodInput => ({
    status: "REPORTED",
    declaration_summary: summary(),
    ...overrides,
})

describe("deriveF29Phase", () => {
    it("returns prior when there is no period", () => {
        expect(deriveF29Phase(null)).toBe("prior")
    })

    it("returns prior when the period has no declaration", () => {
        expect(deriveF29Phase(period({ declaration_summary: undefined }))).toBe("prior")
    })

    it("returns payment when declared with a balance due", () => {
        expect(deriveF29Phase(period())).toBe("payment")
    })

    it("returns payment on partial payment", () => {
        expect(
            deriveF29Phase(period({ declaration_summary: summary({ vat_to_pay: 1000, total_paid: 400 }) })),
        ).toBe("payment")
    })

    it("returns close when fully paid", () => {
        expect(
            deriveF29Phase(
                period({ declaration_summary: summary({ total_paid: 1000, is_fully_paid: true }) }),
            ),
        ).toBe("close")
    })

    it("returns close when vat_to_pay is zero", () => {
        expect(deriveF29Phase(period({ declaration_summary: summary({ vat_to_pay: 0 }) }))).toBe("close")
    })

    it("returns close when vat_to_pay is negative (credit balance)", () => {
        expect(deriveF29Phase(period({ declaration_summary: summary({ vat_to_pay: -250 }) }))).toBe("close")
    })

    it("returns done when the period is CLOSED", () => {
        expect(
            deriveF29Phase(
                period({ status: "CLOSED", declaration_summary: summary({ is_fully_paid: true }) }),
            ),
        ).toBe("done")
    })

    it("returns done when CLOSED even without a declaration summary", () => {
        expect(deriveF29Phase(period({ status: "CLOSED", declaration_summary: undefined }))).toBe("done")
    })

    it("returns payment when vat_to_pay is not a finite number (fail safe)", () => {
        expect(deriveF29Phase(period({ declaration_summary: summary({ vat_to_pay: Number.NaN }) }))).toBe(
            "payment",
        )
    })
})
