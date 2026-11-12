import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ProfitDistribution } from "@/features/contacts"

const mutations = vi.hoisted(() => ({
    execute: { mutateAsync: vi.fn() },
    remove: { mutateAsync: vi.fn() },
}))
vi.mock("../../hooks", () => ({ useProfitDistributionMutations: () => mutations }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/errors", () => ({ showApiError: vi.fn() }))

import { ProfitDistributionActionModal, summarizeDestinations } from "../ProfitDistributionActionModal"

const dist = {
    id: 3, display_id: "DIS-3", fiscal_year: 2025, net_result: "100", resolution_date: "2026-01-01", status: "APPROVED",
    lines: [
        { id: 1, partner: 1, partner_name: "A", net_amount: "60", gross_amount: "60", provisional_withdrawals_offset: "0", percentage_at_date: "60",
          destinations: [{ id: 1, destination: "DIVIDEND", amount: "40" }, { id: 2, destination: "RETAINED", amount: "20" }] },
        { id: 2, partner: 2, partner_name: "B", net_amount: "40", gross_amount: "40", provisional_withdrawals_offset: "0", percentage_at_date: "40", destination: "REINVEST" },
    ],
} as ProfitDistribution

beforeEach(() => vi.clearAllMocks())

describe("summarizeDestinations", () => {
    it("suma por destino usando destinations o el destino legacy de la línea", () => {
        expect(summarizeDestinations(dist).map((s) => [s.key, s.amount])).toEqual([["DIVIDEND", 40], ["REINVEST", 40], ["RETAINED", 20]])
    })
    it("vacío sin líneas", () => {
        expect(summarizeDestinations({ ...dist, lines: undefined })).toEqual([])
    })
})

describe("ProfitDistributionActionModal", () => {
    it("ejecuta tras confirmar", async () => {
        mutations.execute.mutateAsync.mockResolvedValue({})
        const onClose = vi.fn()
        render(<ProfitDistributionActionModal request={{ kind: "execute", distribution: dist }} onClose={onClose} />)
        expect(screen.getByText("Dividendos a pagar")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Ejecutar" }))
        await waitFor(() => expect(mutations.execute.mutateAsync).toHaveBeenCalledWith(3))
    })

    it("elimina el borrador y avisa", async () => {
        mutations.remove.mutateAsync.mockResolvedValue({})
        const onDeleted = vi.fn()
        render(<ProfitDistributionActionModal request={{ kind: "delete", distribution: { ...dist, status: "DRAFT" } }} onClose={vi.fn()} onDeleted={onDeleted} />)
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))
        await waitFor(() => expect(onDeleted).toHaveBeenCalled())
        expect(mutations.remove.mutateAsync).toHaveBeenCalledWith(3)
    })
})

