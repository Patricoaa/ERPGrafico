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
        "purchasing.purchaseorder": render("purchasing.purchaseorder"),
    }
    return { ENTITY_DRAWERS: drawers, hasEntityDrawer: (label: string) => label in drawers }
})

/** Botones que disparan las acciones del provider y el estado del Hub como texto. */
function Controls() {
    const { openEntity, closeEntity, setEntityDisplay } = useGlobalModals()
    const { hubConfig } = useHubPanel()
    return (
        <div>
            <Button onClick={() => openEntity("sales.saledelivery", 1, undefined, undefined, { display: "DES-1" })}>abrir-despacho</Button>
            <Button onClick={() => openEntity("inventory.stockmove", 7)}>abrir-move</Button>
            <Button onClick={() => openEntity("sales.saleorder", 42)}>abrir-ov</Button>
            <Button onClick={() => openEntity("purchasing.purchaseorder", 9)}>abrir-oc</Button>
            <Button onClick={() => setEntityDisplay("sales.saleorder", 42, "OV-000042")}>nombrar-ov</Button>
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

/** ADR-0080 (GAP-11): pila de openEntity con "volver". ADR-0083: OV y OC abren su ficha documental. */
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

    it("opens sale orders in their document sheet, stacked with back (ADR-0083)", () => {
        setup()
        click("abrir-ov")
        expect(screen.getByText("open:sales.saleorder:42")).toBeInTheDocument()
        click("nombrar-ov")
        click("abrir-despacho")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        expect(screen.getByText("volver:OV-000042")).toBeInTheDocument()
        expect(screen.getByText("hub:none")).toBeInTheDocument()
    })

    it("opens purchase orders in their document sheet too (U3); the Hub is never opened", () => {
        setup()
        click("abrir-despacho")
        click("abrir-oc")
        expect(screen.getByText("open:purchasing.purchaseorder:9")).toBeInTheDocument()
        expect(screen.getByText("volver:DES-1")).toBeInTheDocument()
        expect(screen.getByText("hub:none")).toBeInTheDocument()
    })
})
