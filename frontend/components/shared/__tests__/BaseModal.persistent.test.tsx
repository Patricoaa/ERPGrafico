import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import { BaseModal } from "../BaseModal"
import { PersistentPanelContext } from "../PersistentPanelContext"

/** ADR-0101 §10: dentro de una pestaña un modal es un panel a tamaño completo, no un diálogo centrado. */
beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})

describe("BaseModal inside a workspace tab", () => {
    it("renders as a full-size panel (no centred dialog) with title, body and footer", () => {
        render(
            <PersistentPanelContext.Provider value={true}>
                <BaseModal open onOpenChange={() => {}} title="Nuevo presupuesto" footer={<button>Guardar</button>}>
                    <p>contenido</p>
                </BaseModal>
            </PersistentPanelContext.Provider>,
        )
        const panel = screen.getByRole("dialog")
        expect(panel.getAttribute("data-slot")).toBe("sheet-content")
        expect(screen.getByText("Nuevo presupuesto")).toBeInTheDocument()
        expect(screen.getByText("contenido")).toBeInTheDocument()
        expect(screen.getByText("Guardar")).toBeInTheDocument()
    })

    it("stays a centred dialog outside a tab", () => {
        render(
            <BaseModal open onOpenChange={() => {}} title="Aviso">
                <p>contenido</p>
            </BaseModal>,
        )
        expect(screen.getByRole("dialog").getAttribute("data-slot")).toBe("dialog-content")
    })
})
