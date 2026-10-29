import { render, fireEvent, waitFor } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SaleOrderProductStep } from "../steps/SaleOrderProductStep"

// The step never asked for the sale orders (orders stayed empty and the search box was
// not wired), so the "Vincular a Venta" path could not be completed.

const fetchOrders = vi.fn()

vi.mock("@/features/orders", () => ({
    useSaleOrderSearch: () => ({
        orders: [
            {
                id: 5,
                number: "105",
                date: "2026-10-01",
                customer: { name: "Imprenta Cliente" },
                lines: [{ product_type: "MANUFACTURABLE", requires_advanced_manufacturing: true, quantity: 2, unit_price: 10 }],
            },
        ],
        loading: false,
        fetchOrders,
        fetchSingleOrder: vi.fn(),
        singleOrder: null,
    }),
}))

vi.mock("@/lib/api", () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                lines: [
                    {
                        id: 91, product: { id: 3, name: "Volante", code: "VOL" }, product_name: "Volante",
                        product_type: "MANUFACTURABLE", requires_advanced_manufacturing: true,
                        quantity: 500, uom: 1, uom_name: "un", work_order_summary: null,
                    },
                    {
                        id: 92, product: { id: 3, name: "Volante", code: "VOL" }, product_name: "Volante",
                        product_type: "MANUFACTURABLE", requires_advanced_manufacturing: true,
                        quantity: 1000, uom: 1, uom_name: "un", work_order_summary: null,
                    },
                ],
            },
        }),
    },
}))

const renderStep = (props: Partial<React.ComponentProps<typeof SaleOrderProductStep>> = {}) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <SaleOrderProductStep onChooseProduct={vi.fn()} initialOtType="LINKED" {...props} />
        </QueryClientProvider>
    )

describe("SaleOrderProductStep", () => {
    beforeEach(() => vi.clearAllMocks())

    it("loads the sale orders and searches as the user types", async () => {
        renderStep()
        await waitFor(() => expect(fetchOrders).toHaveBeenCalledWith(""))

        fireEvent.change(screen.getByPlaceholderText(/Buscar por número/), { target: { value: "105" } })
        await waitFor(() => expect(fetchOrders).toHaveBeenCalledWith("105"))
    })

    it("offers every pending line, even two lines of the same product", async () => {
        renderStep()
        fireEvent.click(await screen.findByText("OV #105"))
        expect(await screen.findByText(/500/)).toBeInTheDocument()
        expect(screen.getByText(/1000/)).toBeInTheDocument()
    })

    it("opened from a sale order line, it goes straight on with that line", async () => {
        const onChooseProduct = vi.fn()
        renderStep({ onChooseProduct, initialSaleOrderId: "5", initialSaleLineId: "92" })
        await waitFor(() =>
            expect(onChooseProduct).toHaveBeenCalledWith("LINKED", "3", "1000", "1", "Volante", "5", "92")
        )
    })

    it("clicking a product line selects it and calls onChooseProduct", async () => {
        const onChooseProduct = vi.fn()
        renderStep({ onChooseProduct })
        fireEvent.click(await screen.findByText("OV #105"))
        const productLine = await screen.findByText(/500/)
        fireEvent.click(productLine)
        expect(onChooseProduct).toHaveBeenCalledWith("LINKED", "3", "500", "1", "Volante", "5", "91")
    })
})
