import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { WizardStageActions } from "../WizardStageActions"

const caps = { canView: true, canEdit: false, canRewind: true }

describe("WizardStageActions", () => {
    it("starts read-only and reopens the stage while it is still possible", () => {
        const onReopen = vi.fn()
        render(<WizardStageActions isTerminal={false} capabilities={caps} editing={false} onEditingChange={vi.fn()} onReopen={onReopen} />)

        expect(screen.getByRole("button", { name: /Solo lectura/ })).toHaveAttribute("aria-pressed", "true")
        fireEvent.click(screen.getByRole("button", { name: /Reabrir etapa/ }))
        expect(onReopen).toHaveBeenCalledTimes(1)
    })

    it("hides reopen when it is no longer possible and blocks edit with its reason", () => {
        render(
            <WizardStageActions
                isTerminal={false}
                capabilities={{ ...caps, canRewind: false, editBlockedReason: "Existen Órdenes de Compra confirmadas." }}
                editing={false}
                onEditingChange={vi.fn()}
                onReopen={vi.fn()}
            />,
        )
        expect(screen.queryByRole("button", { name: /Reabrir etapa/ })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Editar$/ })).toBeDisabled()
        expect(screen.getByLabelText(/Existen Órdenes de Compra confirmadas/)).toBeInTheDocument()
    })

    it("switches to edit when the stage allows it", () => {
        const onEditingChange = vi.fn()
        render(<WizardStageActions isTerminal={false} capabilities={{ ...caps, canEdit: true }} editing={false} onEditingChange={onEditingChange} onReopen={vi.fn()} />)
        fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }))
        expect(onEditingChange).toHaveBeenCalledWith(true)
    })

    it("offers nothing to change on a closed order", () => {
        render(<WizardStageActions isTerminal capabilities={{ ...caps, canEdit: true }} editing={false} onEditingChange={vi.fn()} onReopen={vi.fn()} />)
        expect(screen.getByRole("button", { name: /^Editar$/ })).toBeDisabled()
        expect(screen.queryByRole("button", { name: /Reabrir etapa/ })).not.toBeInTheDocument()
    })
})
