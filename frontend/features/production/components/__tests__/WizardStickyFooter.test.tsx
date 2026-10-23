import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Layers, Printer, ShoppingCart } from "lucide-react"

import { WizardStickyFooter } from "../WizardStickyFooter"
import type { WorkOrder, WorkOrderStage } from "../../types"

const stages: WorkOrderStage[] = [
    { id: "ORIGIN_SELECTION", label: "Origen", icon: ShoppingCart, alwaysShow: true, isCreationStep: true },
    { id: "MATERIAL_ASSIGNMENT", label: "Materiales", icon: Layers, alwaysShow: true },
    { id: "PREPRESS", label: "Pre-prensa", icon: Printer, alwaysShow: true },
]

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function () {}

function makeOrder(status: string): WorkOrder {
    return {
        id: 1,
        display_id: "OT-001",
        main_product_id: 10,
        product_name: "Flyer A5",
        status,
        current_stage: status === "CANCELLED" ? "" : "PREPRESS",
        requires_prepress: true,
        requires_press: true,
        requires_postpress: false,
        is_manual: false,
        materials: [],
    }
}

function renderFooter(status: string, actualStepIndex: number) {
    const onClose = vi.fn()
    const viewingStepIndex = actualStepIndex >= 0 ? actualStepIndex : 0

    render(
        <WizardStickyFooter
            isViewingCurrentStage={actualStepIndex >= 0}
            stepMode="view"
            onCancelEdit={vi.fn()}
            onClose={onClose}
            pendingTasks={[]}
            canApproveAll={true}
            transitioning={false}
            order={makeOrder(status)}
            stages={stages}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            onBackToCurrent={vi.fn()}
            onTransition={vi.fn()}
            isMaterialApprovalIncomplete={false}
            hasMaterials={true}
        />,
    )

    return { onClose }
}

describe("WizardStickyFooter — terminal states", () => {
    it("offers only a close action for a cancelled order", () => {
        const { onClose } = renderFooter("CANCELLED", -1)

        expect(screen.queryByText("Volver a la Etapa Actual")).not.toBeInTheDocument()
        expect(screen.queryByText("Siguiente Etapa")).not.toBeInTheDocument()
        expect(screen.queryByText("Finalizar Producción")).not.toBeInTheDocument()

        const close = screen.getByRole("button", { name: /Cerrar/ })
        fireEvent.click(close)
        expect(onClose).toHaveBeenCalled()
    })

    it("offers only a close action for a finished order", () => {
        renderFooter("FINISHED", 2)

        expect(screen.queryByText("Siguiente Etapa")).not.toBeInTheDocument()
        expect(screen.queryByText("Finalizar Producción")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Cerrar/ })).toBeInTheDocument()
    })
})
