import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { WizardStageNotice } from "../WizardStageNotice"

const open = { canView: true, canEdit: false, canRewind: true }

describe("WizardStageNotice", () => {
    it("offers a single Reabrir etapa action on a closed stage", () => {
        const onReopen = vi.fn()
        render(<WizardStageNotice isTerminal={false} capabilities={open} editableInline={false} onReopen={onReopen} />)

        expect(screen.getByText("Etapa cerrada · solo lectura")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: /Reabrir etapa/ }))
        expect(onReopen).toHaveBeenCalledTimes(1)
    })

    it("writes the blocking reason as visible text, not a tooltip", () => {
        render(
            <WizardStageNotice
                isTerminal={false}
                capabilities={{ ...open, canRewind: false, rewindBlockedReason: "Retroceso bloqueado: Existen Órdenes de Compra confirmadas." }}
                editableInline={false}
                onReopen={vi.fn()}
            />,
        )

        expect(screen.getByText(/Existen Órdenes de Compra confirmadas/)).toBeVisible()
        expect(screen.getByRole("button", { name: /Reabrir etapa/ })).toBeDisabled()
    })

    it("says the data can still be adjusted when the step is editable in place", () => {
        render(<WizardStageNotice isTerminal={false} capabilities={{ ...open, canEdit: true }} editableInline onReopen={vi.fn()} />)
        expect(screen.getByText("Etapa cerrada · puedes ajustar sus datos")).toBeInTheDocument()
    })

    it("offers nothing to reopen on a closed order", () => {
        render(<WizardStageNotice isTerminal capabilities={{ ...open, canRewind: false }} editableInline={false} onReopen={vi.fn()} />)
        expect(screen.getByText("Orden cerrada · solo lectura")).toBeInTheDocument()
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})
