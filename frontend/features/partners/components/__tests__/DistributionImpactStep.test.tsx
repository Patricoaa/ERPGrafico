import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProfitDistributionImpact, ProfitDistributionImpactPartner } from "@/features/contacts"

const hooks = vi.hoisted(() => ({ useProfitDistributionImpact: vi.fn() }))
vi.mock("../../hooks", () => hooks)

import { DistributionImpactStep } from "../DistributionImpactStep"

const partner = (id: number, name: string, before: string, after: string): ProfitDistributionImpactPartner => ({
    partner: id, partner_name: name, percentage_before: before, percentage_after: after, percentage_changes: before !== after,
    gross_amount: "100", provisional_withdrawals_offset: "0", provisional_balance_before: "0", provisional_balance_after: "0",
    net_amount: "100", dividend: "100", reinvest: "0", retained: "0", loss: "0", equity_before: "0", equity_after: "0",
})

const impact = (partners: ProfitDistributionImpactPartner[]): ProfitDistributionImpact => ({
    resolution: 1, is_profit: true, partners, percentages_change: partners.some(p => p.percentage_changes),
    totals: { gross: "200", provisional_offset: "0", net: "200", dividend: "200", reinvest: "0", retained: "0", loss: "0" },
})

describe("DistributionImpactStep", () => {
    it("desglosa en la alerta el cambio de participación de cada socio que cambia", () => {
        hooks.useProfitDistributionImpact.mockReturnValue({
            impact: impact([partner(1, "Ana", "40", "45"), partner(2, "Beto", "60", "55"), partner(3, "Cira", "10", "10")]),
            isLoading: false, isError: false, refetch: vi.fn(),
        })
        render(<DistributionImpactStep resolutionId={1} />)
        const items = screen.getAllByRole("listitem")
        const text = items.map(li => li.textContent)
        expect(text.some(t => t?.includes("Ana") && t.includes("40% → 45% (+5.00)"))).toBe(true)
        expect(text.some(t => t?.includes("Beto") && t.includes("55%") && t.includes("-5.00"))).toBe(true)
        expect(text.some(t => t?.includes("Cira") && t.includes("→"))).toBe(false)
        expect(screen.queryByText("Participación")).not.toBeInTheDocument()
    })
})
