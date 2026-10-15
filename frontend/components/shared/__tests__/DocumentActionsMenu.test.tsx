import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import React from "react"

import { DocumentActionsMenu } from "../DocumentActionsMenu"

/** ADR-0083: menú único de acciones en la cabecera de la ficha. */
describe("DocumentActionsMenu", () => {
    const open = () => fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones" }), { button: 0, ctrlKey: false })

    it("lists next step first, then actions, print and destructive last", () => {
        const print = vi.fn()
        render(
            <DocumentActionsMenu
                primary={{ id: "deliver", label: "Registrar despacho", onClick: vi.fn() }}
                actions={[
                    { id: "annul", label: "Anular orden", onClick: vi.fn(), destructive: true },
                    { id: "deliver", label: "Registrar despacho", onClick: vi.fn() },
                    { id: "pay", label: "Registrar pago", onClick: vi.fn(), disabled: true, disabledReason: "Sin saldo" },
                ]}
                onPrint={print}
            />,
        )
        open()
        const items = screen.getAllByRole("menuitem").map((el) => el.textContent)
        expect(items).toEqual(["Registrar despacho", "Registrar pagoSin saldo", "Imprimir", "Anular orden"])
        expect(screen.getByText("Siguiente paso")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Imprimir"))
        expect(print).toHaveBeenCalled()
    })

    it("renders nothing without actions", () => {
        const { container } = render(<DocumentActionsMenu actions={[]} />)
        expect(container).toBeEmptyDOMElement()
    })
})
