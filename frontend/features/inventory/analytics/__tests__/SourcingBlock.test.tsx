import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MakeVsBuy, Sourcing, SourcingParams } from "../sourcing.types"

const state = vi.hoisted(() => ({
    data: null as unknown,
    isLoading: false,
    isError: false,
    useSourcing: vi.fn(),
}))

vi.mock("../../hooks/useProductSourcing", () => ({
    useProductSourcing: (id: number, params: unknown) => {
        state.useSourcing(id, params)
        return { data: state.data, isLoading: state.isLoading, isError: state.isError }
    },
}))

import { SourcingBlock } from "../SourcingBlock"

const MVB: MakeVsBuy = {
    make: { unit_cost: 20, bom_cost: 24, units_made: 10, orders: 2 },
    buy: { avg_unit_cost: 50, last_unit_cost: 55, last_date: "2026-05-01", units_bought: 40, receipts: 3 },
    saving_per_unit: 30, saving_total: 300, cheaper: "MAKE",
}
const FULL: Sourcing = {
    make_vs_buy: MVB,
    used_in: {
        increase_pct: 10,
        parents: [{
            product_id: 5, name: "Tarjeta Doble Faz", qty_per_unit: 2, component_cost: 200, bom_cost: 500,
            share_pct: 40, delta_cost: 20, delta_pct: 4, price_net: 1000, margin_pct: 50, margin_pct_after: 46,
        }],
    },
}

beforeEach(() => {
    vi.clearAllMocks()
    state.data = FULL
    state.isLoading = false
    state.isError = false
})

const lastParams = (): SourcingParams => state.useSourcing.mock.calls.at(-1)?.[1] as SourcingParams

describe("SourcingBlock", () => {
    it("compares making and buying and says which is cheaper", () => {
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByText("Fabricar")).toBeInTheDocument()
        expect(screen.getByText("Comprar")).toBeInTheDocument()
        expect(screen.getByText(/Fabricar es más barato/)).toBeInTheDocument()
    })

    it("says buying is cheaper when the saving is negative", () => {
        state.data = { ...FULL, make_vs_buy: { ...MVB, saving_per_unit: -30, saving_total: -300, cheaper: "BUY" } }
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByText(/Comprar es más barato/)).toBeInTheDocument()
    })

    it("explains which side is missing instead of showing a saving", () => {
        state.data = {
            ...FULL,
            make_vs_buy: { ...MVB, buy: { ...MVB.buy, receipts: 0, avg_unit_cost: 0, last_unit_cost: 0, last_date: null, units_bought: 0 }, saving_per_unit: null, saving_total: null, cheaper: null },
        }
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByText("Sin compras recibidas en el periodo")).toBeInTheDocument()
        expect(screen.queryByText(/es más barato/)).not.toBeInTheDocument()
    })

    it("lists the parent products where the input is used", () => {
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByText("Tarjeta Doble Faz")).toBeInTheDocument()
    })

    it("hides the sections that do not apply", () => {
        state.data = { make_vs_buy: null, used_in: FULL.used_in }
        const { rerender } = render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.queryByText("Fabricar")).not.toBeInTheDocument()
        state.data = { make_vs_buy: MVB, used_in: null }
        rerender(<SourcingBlock productId={7} period="12m" />)
        expect(screen.queryByText("Tarjeta Doble Faz")).not.toBeInTheDocument()
        expect(screen.getByText("Fabricar")).toBeInTheDocument()
    })

    it("refetches with the new increase when the sensitivity changes", () => {
        render(<SourcingBlock productId={7} period="12m" />)
        expect(lastParams().increase_pct).toBe(10)
        fireEvent.click(screen.getByRole("radio", { name: "20 %" }))
        expect(lastParams().increase_pct).toBe(20)
    })

    it("derives date_from from the period and omits it for the history", () => {
        const { rerender } = render(<SourcingBlock productId={7} period="3m" />)
        expect(lastParams().date_from).toBeDefined()
        rerender(<SourcingBlock productId={7} period="all" />)
        expect(lastParams().date_from).toBeUndefined()
    })

    it("no longer renders its own range selector", () => {
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.queryByRole("radio", { name: "24 m" })).not.toBeInTheDocument()
    })

    it("shows an empty state when nothing applies", () => {
        state.data = { make_vs_buy: null, used_in: null }
        render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByText("Este producto no tiene datos de abastecimiento que analizar")).toBeInTheDocument()
    })

    it("shows loading and error states", () => {
        state.data = null
        state.isLoading = true
        const { rerender } = render(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByLabelText("Cargando análisis del producto")).toBeInTheDocument()
        state.isLoading = false
        state.isError = true
        rerender(<SourcingBlock productId={7} period="12m" />)
        expect(screen.getByRole("alert")).toBeInTheDocument()
    })
})
