import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Layers, Printer, ShoppingCart } from "lucide-react"

import { WizardStickyFooter } from "../WizardStickyFooter"
import type { WorkOrder, WorkOrderStage, WorkOrderTask } from "../../types"

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
    const viewingStepIndex = actualStepIndex >= 0 ? actualStepIndex : 0

    render(
        <WizardStickyFooter
            isViewingCurrentStage={actualStepIndex >= 0}
            pendingTasks={[]}
            canApproveAll={true}
            transitioning={false}
            order={makeOrder(status)}
            stages={stages}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            onTransition={vi.fn()}
            isMaterialApprovalIncomplete={false}
            hasMaterials={true}
        />,
    )
}

function renderFlowFooter(options: {
    stages: WorkOrderStage[]
    viewingStepIndex?: number
    hasMaterials?: boolean
    isMaterialApprovalIncomplete?: boolean
    materialApprovalBlockedReason?: string
    isRectificationStep?: boolean
    onRectifyAndFinish?: () => void | Promise<void>
    pendingTasks?: WorkOrderTask[]
    canApproveAll?: boolean
}) {
    const viewingStepIndex = options.viewingStepIndex ?? 0
    const onTransition = vi.fn()

    render(
        <WizardStickyFooter
            isViewingCurrentStage
            pendingTasks={options.pendingTasks ?? []}
            canApproveAll={options.canApproveAll ?? true}
            transitioning={false}
            order={makeOrder("IN_PROGRESS")}
            stages={options.stages}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={viewingStepIndex}
            onTransition={onTransition}
            isMaterialApprovalIncomplete={options.isMaterialApprovalIncomplete ?? false}
            materialApprovalBlockedReason={options.materialApprovalBlockedReason}
            hasMaterials={options.hasMaterials ?? true}
            isRectificationStep={options.isRectificationStep}
            onRectifyAndFinish={options.onRectifyAndFinish}
        />,
    )

    return { onTransition }
}

const workflowStages: WorkOrderStage[] = [
    { id: "MATERIAL_ASSIGNMENT", label: "Asignación de Materiales", icon: Layers, alwaysShow: true },
    { id: "MATERIAL_APPROVAL", label: "Aprobación de Stock", icon: Layers, alwaysShow: true },
    { id: "OUTSOURCING_ASSIGNMENT", label: "Asignación de Tercerizados", icon: Layers, alwaysShow: true },
    { id: "RECTIFICATION", label: "Rectificación", icon: Printer, alwaysShow: true },
    { id: "FINISHED", label: "Finalizada", icon: Printer, alwaysShow: true },
]

describe("WizardStickyFooter — terminal states", () => {
    it("shows no navigation actions for a cancelled order", () => {
        renderFooter("CANCELLED", -1)

        expect(screen.queryByText("Siguiente Etapa")).not.toBeInTheDocument()
        expect(screen.queryByText("Finalizar Producción")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Cerrar/ })).not.toBeInTheDocument()
    })

    it("shows no navigation actions for a finished order", () => {
        renderFooter("FINISHED", 2)

        expect(screen.queryByText("Siguiente Etapa")).not.toBeInTheDocument()
        expect(screen.queryByText("Finalizar Producción")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Cerrar/ })).not.toBeInTheDocument()
    })
})

describe("WizardStickyFooter — transition confirmations", () => {
    it("advances routine stages without a confirmation dialog", () => {
        const { onTransition } = renderFlowFooter({ stages: workflowStages })

        fireEvent.click(screen.getByRole("button", { name: "Siguiente Etapa" }))

        expect(onTransition).toHaveBeenCalledWith("MATERIAL_APPROVAL")
        expect(screen.queryByText(/Podrás reabrir esta etapa/)).not.toBeInTheDocument()
    })

    it("asks explicitly before continuing with no assigned materials or services", () => {
        const { onTransition } = renderFlowFooter({ stages: workflowStages, hasMaterials: false })

        fireEvent.click(screen.getByRole("button", { name: "Siguiente Etapa" }))

        expect(screen.getByRole("dialog")).toHaveTextContent("Continuar sin materiales")
        expect(screen.getByText(/No se registrará consumo de componentes/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Continuar sin materiales" }))

        expect(onTransition).toHaveBeenCalledWith("MATERIAL_APPROVAL")
    })

    it("explains the draft-to-in-progress change when activating production", () => {
        const { onTransition } = renderFlowFooter({
            stages: workflowStages,
            viewingStepIndex: 1,
        })

        fireEvent.click(screen.getByRole("button", { name: "Siguiente Etapa" }))

        expect(screen.getByRole("dialog")).toHaveTextContent("Activar producción")
        expect(screen.getByText(/La OT pasará de Borrador a En Proceso/)).toBeInTheDocument()
        expect(screen.queryByText(/todas las modificaciones quedarán auditadas/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Activar producción" }))

        expect(onTransition).toHaveBeenCalledWith("OUTSOURCING_ASSIGNMENT")
    })

    it("describes inventory and purchase-order requirements before finalization", () => {
        const finalStages = [workflowStages[3], workflowStages[4]]
        const { onTransition } = renderFlowFooter({ stages: finalStages })

        fireEvent.click(screen.getByRole("button", { name: "Finalizar Producción" }))

        expect(screen.getByText(/si el producto controla inventario/)).toBeInTheDocument()
        expect(screen.getByText(/deben estar recibidas completamente/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Finalizar producción" }))

        expect(onTransition).toHaveBeenCalledWith("FINISHED")
    })

    it("explains rectification values and the final effects", () => {
        const onRectifyAndFinish = vi.fn()
        renderFlowFooter({
            stages: [workflowStages[3], workflowStages[4]],
            isRectificationStep: true,
            onRectifyAndFinish,
        })

        fireEvent.click(screen.getByRole("button", { name: "Rectificar y Finalizar Producción" }))

        expect(screen.getByText(/los datos que no ajustes conservarán la cantidad planificada/)).toBeInTheDocument()
        expect(screen.getByText(/Órdenes de Compra vinculadas deben estar recibidas completamente/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Rectificar y finalizar" }))

        expect(onRectifyAndFinish).toHaveBeenCalledOnce()
    })

    it("shows actionable reasons next to disabled transitions", () => {
        renderFlowFooter({
            stages: workflowStages,
            viewingStepIndex: 1,
            isMaterialApprovalIncomplete: true,
            materialApprovalBlockedReason: "Stock insuficiente para 2 componentes (Papel, Tinta). Repón existencias en la bodega asignada a la OT y vuelve a comprobar.",
        })

        expect(screen.getByText(/Stock insuficiente para 2 componentes \(Papel, Tinta\)/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Siguiente Etapa" })).toBeDisabled()
    })

    it("identifies approvals the current user cannot complete", () => {
        const pendingTask: WorkOrderTask = {
            id: 8,
            task_type: "OT_MATERIAL_APPROVAL",
            status: "PENDING",
        }
        renderFlowFooter({
            stages: workflowStages,
            pendingTasks: [pendingTask],
            canApproveAll: false,
        })

        expect(screen.getByText(/tu usuario no puede completar/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Siguiente Etapa" })).toBeDisabled()
    })
})
