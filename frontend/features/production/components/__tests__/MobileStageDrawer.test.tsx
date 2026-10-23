import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Layers, Printer, ShoppingCart } from "lucide-react"

import { MobileStageDrawer } from "../MobileStageDrawer"
import type { WorkOrder, WorkOrderStage } from "../../types"

// Polyfills required by the Drawer / Tooltip tree (jsdom lacks these).
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

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

function renderPicker(overrides: Partial<Parameters<typeof MobileStageDrawer>[0]> = {}) {
    const onStepClick = vi.fn()
    render(
        <MobileStageDrawer
            stages={stages}
            viewingStepIndex={1}
            actualStepIndex={1}
            stepMode="view"
            order={makeOrder()}
            isCreating={false}
            chosenOtType={null}
            onStepClick={onStepClick}
            {...overrides}
        />,
    )
    return { onStepClick }
}

describe("MobileStageDrawer", () => {
    it("opens a bottom sheet with per-stage detail and blockers", async () => {
        renderPicker()

        const trigger = screen.getByRole("button", { name: /Materiales/ })
        expect(trigger).toHaveTextContent("02 / 03")

        fireEvent.click(trigger)

        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText("Etapas")).toBeInTheDocument()
        expect(within(dialog).getByText("Preparación")).toBeInTheDocument()
        expect(within(dialog).getByText("Producción")).toBeInTheDocument()
        expect(within(dialog).getByText("1/2 disponibles · 1 faltante")).toBeInTheDocument()
        expect(within(dialog).getByText("1 material sin stock")).toBeInTheDocument()
        expect(within(dialog).getByText("Viendo")).toBeInTheDocument()
    })

    it("keeps future stages disabled and navigates to past ones", async () => {
        const { onStepClick } = renderPicker()
        fireEvent.click(screen.getByRole("button", { name: /Materiales/ }))

        const dialog = await screen.findByRole("dialog")
        const future = within(dialog).getByRole("button", { name: /Pre-prensa/ })
        expect(future).toBeDisabled()

        const past = within(dialog).getByRole("button", { name: /Origen/ })
        expect(past).not.toBeDisabled()
        fireEvent.click(past)

        expect(onStepClick).toHaveBeenCalledWith(0)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("marks the real current stage when viewing history", async () => {
        renderPicker({ viewingStepIndex: 0 })
        fireEvent.click(screen.getByRole("button", { name: /Origen/ }))

        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByText("Actual")).toBeInTheDocument()
    })

    it("locks creation stages until an origin type is chosen", async () => {
        renderPicker({
            isCreating: true,
            viewingStepIndex: 0,
            actualStepIndex: 0,
            order: null,
            chosenOtType: null,
        })

        fireEvent.click(screen.getByRole("button", { name: /Origen/ }))

        const dialog = await screen.findByRole("dialog")
        expect(within(dialog).getByRole("button", { name: /Origen/ })).not.toBeDisabled()
        expect(within(dialog).getByRole("button", { name: /Materiales/ })).toBeDisabled()
        expect(within(dialog).getByRole("button", { name: /Pre-prensa/ })).toBeDisabled()
    })
})
