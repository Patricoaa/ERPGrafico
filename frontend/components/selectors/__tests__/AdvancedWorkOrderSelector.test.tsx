import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdvancedWorkOrderSelector } from "../AdvancedWorkOrderSelector"
import type { WorkOrder } from "@/types/entities"

const { fetchOrders, fetchSingleOrder, searchState } = vi.hoisted(() => ({
    fetchOrders: vi.fn(),
    fetchSingleOrder: vi.fn(),
    searchState: { singleOrder: null as WorkOrder | null },
}))

vi.mock("@/features/production/hooks/useWorkOrderSearch", () => ({
    useWorkOrderSearch: () => ({
        orders: [],
        singleOrder: searchState.singleOrder,
        loading: false,
        fetchOrders,
        fetchSingleOrder,
    }),
}))

vi.mock("@/features/production", () => ({
    WorkOrderWizard: () => null,
}))

const selectedOrder: WorkOrder = {
    id: 5,
    number: "5",
    product_name: "Etiqueta autoadhesiva",
    created_at: "2026-10-29T12:00:00Z",
    status: "PENDING",
}

describe("AdvancedWorkOrderSelector", () => {
    beforeEach(() => {
        searchState.singleOrder = null
        fetchOrders.mockClear()
        fetchSingleOrder.mockClear()
    })

    it("renders the placeholder instead of crashing when no order is selected", () => {
        render(<AdvancedWorkOrderSelector value={null} onChange={vi.fn()} />)

        expect(screen.getByRole("combobox")).toBeInTheDocument()
        expect(screen.getByText("Seleccionar...")).toBeInTheDocument()
    })

    it("renders the folio of the selected order", async () => {
        searchState.singleOrder = selectedOrder

        render(<AdvancedWorkOrderSelector value="5" onChange={vi.fn()} />)

        expect(await screen.findByText("OT-5")).toBeInTheDocument()
        expect(screen.queryByText("Seleccionar...")).not.toBeInTheDocument()
    })
})
