import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"

import { GlobalModalProvider, useGlobalModals } from "../GlobalModalProvider"
import { HubPanelProvider, useHubPanel } from "../HubPanelProvider"
import { useEntityNavigation } from "@/components/shared"
import { Button } from "@/components/ui/button"

vi.mock("next/navigation", () => ({ usePathname: () => "/sales/orders" }))

// Drawer de prueba: muestra qué documento está abierto y el "volver" disponible.
function FakeDrawer({ label, id }: { label: string; id: number }) {
    const navigation = useEntityNavigation()
    return (
        <div>
            <span>open:{label}:{id}</span>
            {navigation && <Button onClick={navigation.goBack}>volver:{navigation.backLabel}</Button>}
        </div>
    )
}

vi.mock("@/lib/entity-drawers", () => {
    const render = (label: string) => function EntityDrawerStub({ id }: { id: number }) {
        return <FakeDrawer label={label} id={id} />
    }
    const drawers: Record<string, unknown> = {
        "sales.saledelivery": render("sales.saledelivery"),
        "inventory.stockmove": render("inventory.stockmove"),
        "sales.saleorder": render("sales.saleorder"),
    }
    return { ENTITY_DRAWERS: drawers, hasEntityDrawer: (label: string) => label in drawers }
})

/** Botones que disparan las acciones del provider y el estado del Hub como texto. */
function Controls() {
    const { openEntity, closeEntity } = useGlobalModals()
    const { hubConfig } = useHubPanel()
    return (
        <div>
            <Button onClick={() => openEntity("sales.saledelivery", 1, undefined, undefined, { display: "DES-1" })}>abrir-despacho</Button>
            <Button onClick={() => openEntity("inventory.stockmove", 7)}>abrir-move</Button>
            <Button onClick={() => openEntity("sales.saleorder", 42)}>abrir-ov</Button>
            <Button onClick={closeEntity}>cerrar</Button>
            <span>hub:{hubConfig ? `${hubConfig.type}:${hubConfig.orderId}` : "none"}</span>
        </div>
    )
}

const setup = () => render(
    <HubPanelProvider>
        <GlobalModalProvider>
            <Controls />
        </GlobalModalProvider>
    </HubPanelProvider>
)

const click = (name: string) => act(() => screen.getByText(name).click())

/** ADR-0080 (GAP-11, D4): pila de openEntity con "volver" y OV/OC → Order Hub. */
describe("GlobalModalProvider entity stack", () => {
    it("stacks documents opened from another one and goes back", () => {
        setup()
        click("abrir-despacho")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        expect(screen.queryByText(/volver:/)).toBeNull()

        click("abrir-move")
        expect(screen.getByText("open:inventory.stockmove:7")).toBeInTheDocument()

        click("volver:DES-1")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        expect(screen.queryByText(/volver:/)).toBeNull()
    })

    it("closeEntity clears the whole stack and re-opening the top is a no-op", () => {
        setup()
        click("abrir-despacho")
        click("abrir-despacho")
        expect(screen.queryByText(/volver:/)).toBeNull()
        click("cerrar")
        expect(screen.queryByText(/open:/)).toBeNull()
    })

    it("opens sale orders in the Order Hub (D4) instead of a drawer", () => {
        setup()
        click("abrir-despacho")
        click("abrir-ov")
        expect(screen.getByText("hub:sale:42")).toBeInTheDocument()
        expect(screen.queryByText(/open:/)).toBeNull()
    })
})
