import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Layers, Printer, ShoppingCart } from "lucide-react"

import { WizardProcessSidebar } from "../WizardProcessSidebar"
import type { WorkOrder, WorkOrderStage, WizardStepMode } from "../../types"

const stages: WorkOrderStage[] = [
    { id: "ORIGIN_SELECTION", label: "Origen", icon: ShoppingCart, alwaysShow: true, isCreationStep: true },
    { id: "MATERIAL_ASSIGNMENT", label: "Materiales", icon: Layers, alwaysShow: true },
    { id: "PREPRESS", label: "Pre-prensa", icon: Printer, alwaysShow: true },
]

function makeOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
    return {
        id: 1,
        display_id: "OT-001",
        main_product_id: 10,
        product_name: "Flyer A5",
        status: "DRAFT",
        current_stage: "MATERIAL_ASSIGNMENT",
        requires_prepress: true,
        requires_press: true,
        requires_postpress: false,
        is_manual: false,
        sale_order: { id: 5, number: "123" },
        materials: [
            {
                id: 1, component: 1, component_name: "Papel", quantity_planned: 100,
                uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false,
                is_available: true,
            },
            {
                id: 2, component: 2, component_name: "Tinta", quantity_planned: 5,
                uom: 1, uom_name: "u", total_cost: 0, source: "BOM", is_outsourced: false,
                is_available: false,
            },
        ],
        ...overrides,
    }
}

function renderSidebar(
    order: WorkOrder,
    viewingStepIndex = 1,
    actualStepIndex = 1,
    stepMode: WizardStepMode = "view",
) {
    return render(
        <WizardProcessSidebar
            stages={stages}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            stepMode={stepMode}
            onStepClick={vi.fn()}
            order={order}
        />,
    )
}

describe("WizardProcessSidebar — status board", () => {
    it("renders per-stage detail, sections and progress", () => {
        renderSidebar(makeOrder())

        expect(screen.getByText("Vinculada a OV #123")).toBeInTheDocument()
        expect(screen.getByText("1/2 disponibles · 1 faltante")).toBeInTheDocument()
        expect(screen.getAllByText("Preparación")).toHaveLength(1)
        expect(screen.getAllByText("Producción")).toHaveLength(1)
        expect(screen.getByTestId("rail-progress")).toHaveAttribute("aria-valuenow", "67")
        expect(screen.getByText("Viendo 02 / 03")).toBeInTheDocument()
    })

    it("shows the blocker warning on the current stage", () => {
        renderSidebar(makeOrder())

        expect(screen.getByTitle("1 material sin stock")).toBeInTheDocument()
        expect(screen.getByTestId("step-1").querySelector("button")).toHaveAttribute(
            "aria-label",
            expect.stringContaining("atención: 1 material sin stock"),
        )
    })

    it("marks the real current stage when viewing a past step", () => {
        renderSidebar(makeOrder(), 0, 1)

        expect(screen.getByText("Actual")).toBeInTheDocument()
        expect(screen.getByText("Viendo 01 / 03")).toBeInTheDocument()
    })

    it("does not show warnings for past stages", () => {
        renderSidebar(makeOrder(), 2, 2)

        // The materials warning belongs to a past stage now.
        expect(screen.queryByTitle("1 material sin stock")).not.toBeInTheDocument()
    })

    it("uses the history timestamp as detail when no operational data exists", () => {
        renderSidebar(
            makeOrder({
                status: "IN_PROGRESS",
                current_stage: "PREPRESS",
                stage_history: [
                    {
                        id: 1,
                        stage: "PREPRESS",
                        status: "IN_PROGRESS",
                        created_at: "2026-10-20T10:00:00Z",
                        user_name: "Ana",
                    },
                ],
            }),
            2,
            2,
        )

        expect(screen.getByText("Desde 20/10/2026 · Ana")).toBeInTheDocument()
    })

    it("exposes blocked governance actions as focusable disabled controls", () => {
        renderSidebar(makeOrder({ status: "IN_PROGRESS" }), 0, 1)

        const edit = screen.getByLabelText(/Editar datos de etapa: No se puede editar/)
        expect(edit).toHaveAttribute("aria-disabled", "true")
        expect(edit).toHaveAttribute("tabindex", "0")
        expect(edit).toHaveAttribute("title", expect.stringContaining("No se puede editar"))

        const rewind = screen.getByLabelText(/Retroceder a esta etapa: No se puede retroceder/)
        expect(rewind).toHaveAttribute("aria-disabled", "true")
        expect(rewind).toHaveAttribute("tabindex", "0")

        // View stays enabled and is a real button.
        expect(screen.getByLabelText("Ver etapa (solo lectura)").tagName).toBe("BUTTON")
    })

    it("labels the active edit and rewind modes", () => {
        const { rerender } = renderSidebar(makeOrder(), 1, 1, "edit-in-place")
        expect(screen.getByText("Editando")).toBeInTheDocument()

        rerender(
            <WizardProcessSidebar
                stages={stages}
                viewingStepIndex={1}
                actualStepIndex={1}
                stepMode="rewind"
                onStepClick={vi.fn()}
                order={makeOrder()}
            />,
        )
        expect(screen.getByText("Retroceso")).toBeInTheDocument()
    })

    it("does not render governance actions on future stages", () => {
        renderSidebar(makeOrder(), 1, 1)

        const futureRow = screen.getByTestId("step-2")
        expect(within(futureRow).queryByRole("button", { name: /Ver etapa/ })).not.toBeInTheDocument()
        expect(within(futureRow).queryByLabelText(/Editar datos de etapa/)).not.toBeInTheDocument()
    })
})
