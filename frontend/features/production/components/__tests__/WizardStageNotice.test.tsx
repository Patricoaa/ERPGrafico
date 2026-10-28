import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { WizardStageNotice } from "../WizardStageNotice"
import { Package } from "lucide-react"
import type { WorkOrderStage } from "../../types"

const mockStage: WorkOrderStage = {
    id: "MATERIAL_ASSIGNMENT",
    label: "Asignación de Materiales",
    icon: Package,
    alwaysShow: true,
}

const openCaps = { canView: true, canEdit: false, canRewind: true }

describe("WizardStageNotice", () => {
    it("shows Reabrir etapa button for a past stage that can be rewound", () => {
        const onReopen = vi.fn()
        render(
            <WizardStageNotice
                stage={mockStage}
                isCurrent={false}
                isTerminal={false}
                capabilities={openCaps}
                editableInline={false}
                onReopen={onReopen}
            />
        )

        expect(screen.getByText("Asignación de Materiales")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: /Reabrir etapa/ }))
        expect(onReopen).toHaveBeenCalledTimes(1)
    })

    it("writes the blocking reason as visible text, not a tooltip", () => {
        render(
            <WizardStageNotice
                stage={mockStage}
                isCurrent={false}
                isTerminal={false}
                capabilities={{ ...openCaps, canRewind: false, rewindBlockedReason: "Retroceso bloqueado: Existen Órdenes de Compra confirmadas." }}
                editableInline={false}
                onReopen={vi.fn()}
            />,
        )

        expect(screen.getByText(/Existen Órdenes de Compra confirmadas/)).toBeVisible()
        expect(screen.queryByRole("button", { name: /Reabrir/ })).not.toBeInTheDocument()
    })

    it("shows Editable badge when the step allows inline edits", () => {
        render(
            <WizardStageNotice
                stage={mockStage}
                isCurrent={false}
                isTerminal={false}
                capabilities={{ ...openCaps, canEdit: true }}
                editableInline
                onReopen={vi.fn()}
            />
        )
        expect(screen.getByText("Editable")).toBeInTheDocument()
        expect(screen.getByText(/Puedes ajustar sus datos/i)).toBeInTheDocument()
    })

    it("shows Activa badge and no reopen for the current stage", () => {
        render(
            <WizardStageNotice
                stage={mockStage}
                isCurrent
                isTerminal={false}
                editableInline={false}
                onReopen={vi.fn()}
            />
        )
        expect(screen.getByText("Activa")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Reabrir/ })).not.toBeInTheDocument()
    })

    it("shows Solo lectura and no reopen button for a terminal order", () => {
        render(
            <WizardStageNotice
                stage={mockStage}
                isCurrent={false}
                isTerminal
                capabilities={{ ...openCaps, canRewind: false }}
                editableInline={false}
                onReopen={vi.fn()}
            />
        )
        expect(screen.getByText("Solo lectura")).toBeInTheDocument()
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})
