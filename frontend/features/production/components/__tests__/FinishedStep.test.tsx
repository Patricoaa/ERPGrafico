import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { FinishedStep } from "../steps/FinishedStep"
import type { WorkOrder, WorkOrderProductionOutcome } from "../../types"

const baseOrder = { id: 1, status: "FINISHED", current_stage: "FINISHED", uom_name: "und" } as unknown as WorkOrder

const outcome = (over: Partial<WorkOrderProductionOutcome>): WorkOrderProductionOutcome => ({
    kind: "STOCK",
    finished_at: "2026-10-20T10:00:00Z",
    product_name: "Tarjetas",
    quantity: 500,
    stocked: true,
    warehouse_name: "Bodega Central",
    sale_order: null,
    delivery: null,
    ...over,
})

describe("FinishedStep — destino del producto", () => {
    it("shows the warehouse a stock OT entered and that it is available", () => {
        render(<FinishedStep order={{ ...baseOrder, production_outcome: outcome({}) }} />)
        expect(screen.getByText("Ingresó a Bodega Central")).toBeInTheDocument()
        expect(screen.getByText("Disponible para la venta")).toBeInTheDocument()
    })

    it("shows a sale order still waiting for delivery", () => {
        render(
            <FinishedStep
                order={{
                    ...baseOrder,
                    production_outcome: outcome({
                        kind: "SALE_ORDER",
                        sale_order: { id: 9, number: "42" },
                        delivery: { status: "PARTIAL", ordered: 500, delivered: 200 },
                    }),
                }}
            />,
        )
        expect(screen.getByText("Esperando entrega al cliente")).toBeInTheDocument()
        expect(screen.getByRole("progressbar", { name: "Avance de entrega" })).toHaveAttribute("aria-valuenow", "40")
        expect(screen.queryByText("Disponible para la venta")).not.toBeInTheDocument()
    })

    it("marks a delivered sale order as delivered", () => {
        render(
            <FinishedStep
                order={{
                    ...baseOrder,
                    production_outcome: outcome({
                        kind: "SALE_ORDER",
                        stocked: false,
                        sale_order: { id: 9, number: "42" },
                        delivery: { status: "DELIVERED", ordered: 500, delivered: 500 },
                    }),
                }}
            />,
        )
        expect(screen.getByText("Entregado al cliente")).toBeInTheDocument()
        expect(screen.getByText("Sin ingreso a inventario")).toBeInTheDocument()
    })
})
