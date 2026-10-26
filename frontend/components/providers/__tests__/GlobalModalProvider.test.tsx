import { render, screen, act, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React, { useEffect } from "react"
import Link from "next/link"

import { GlobalModalProvider, useGlobalModals } from "../GlobalModalProvider"
import { Button } from "@/components/ui/button"

const nav = vi.hoisted(() => ({ pathname: "/sales/orders", push: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: nav.push }) }))

// Drawer de prueba: muestra qué documento está abierto y permite cerrarlo (X).
function FakeDrawer({ label, id, onOpenChange, onSuccess }: { label: string; id: number; onOpenChange?: (open: boolean) => void; onSuccess?: () => void }) {
    return (
        <div>
            <span>open:{label}:{id}</span>
            <Button onClick={() => onOpenChange?.(false)}>x</Button>
            <Button onClick={() => onSuccess?.()}>guardado</Button>
        </div>
    )
}

vi.mock("@/lib/entity-drawers", () => {
    const render = (label: string) => function EntityDrawerStub({ id, onOpenChange, onSuccess }: { id: number; onOpenChange?: (open: boolean) => void; onSuccess?: () => void }) {
        return <FakeDrawer label={label} id={id} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    }
    const drawers: Record<string, unknown> = {
        "sales.saledelivery": render("sales.saledelivery"),
        "inventory.stockmove": render("inventory.stockmove"),
        "sales.saleorder": render("sales.saleorder"),
    }
    return { ENTITY_DRAWERS: drawers, hasEntityDrawer: (label: string) => label in drawers }
})

// La calculadora real trae medio ERP: aquí solo importa que se monte con `open` según la pestaña activa.
vi.mock("@/components/tools/CostCalculatorDrawer", () => ({
    CostCalculatorDrawer: ({ open }: { open: boolean }) => <span>calculadora:{open ? "abierta" : "oculta"}</span>,
}))

/** Botones que disparan las acciones del provider y lista las pestañas con su estado. */
function Controls() {
    const { openEntity, openTool, closeEntity, setEntityDisplay, tabs, activateTab, closeTab } = useGlobalModals()
    return (
        <div>
            <Button onClick={() => openEntity("sales.saledelivery", 1, undefined, undefined, { display: "DES-1" })}>abrir-despacho</Button>
            <Button onClick={() => openEntity("inventory.stockmove", 7, undefined, undefined, { display: "MOV-7" })}>abrir-move</Button>
            <Button onClick={() => openEntity("sales.saleorder", 42, undefined, undefined, { display: "OV-42" })}>abrir-ov</Button>
            <Button onClick={() => openTool("cost-calculator")}>abrir-calculadora</Button>
            <Button onClick={() => setEntityDisplay("sales.saleorder", 42, "OV-000042")}>nombrar-ov</Button>
            <Button onClick={closeEntity}>cerrar-todo</Button>
            {tabs.map((tab) => (
                <div key={tab.key}>
                    <Button onClick={() => activateTab(tab.key)}>{`tab:${tab.title}${tab.active ? "*" : ""}`}</Button>
                    <Button onClick={() => closeTab(tab.key)}>{`cerrar:${tab.title}`}</Button>
                    <span>{`desc:${tab.description}`}</span>
                </div>
            ))}
        </div>
    )
}

const setup = () => render(
    <GlobalModalProvider>
        <Controls />
    </GlobalModalProvider>
)

const click = (name: string) => act(() => screen.getByText(name).click())
const tabTitles = () => screen.queryAllByText(/^tab:/).map((el) => el.textContent)

beforeEach(() => { nav.pathname = "/sales/orders"; nav.push.mockReset() })

/** ADR-0101: pestañas efímeras por página; solo la activa se monta. */
describe("GlobalModalProvider workspace tabs", () => {
    it("opens each document as a tab and activates the newest", () => {
        setup()
        click("abrir-despacho")
        click("abrir-move")
        expect(tabTitles()).toEqual(["tab:DES-1", "tab:MOV-7*"])
        expect(screen.getByText("open:inventory.stockmove:7")).toBeInTheDocument()
        expect(screen.queryByText("open:sales.saledelivery:1")).toBeNull()
    })

    it("switches tabs without duplicating and re-opening an open document just activates it", () => {
        setup()
        click("abrir-despacho")
        click("abrir-move")
        click("abrir-despacho")
        expect(screen.getAllByText(/^tab:/)).toHaveLength(2)
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        click("tab:DES-1*")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
    })

    it("closing the active tab activates its right neighbour, or the left one at the end", () => {
        setup()
        click("abrir-despacho")
        click("abrir-ov")
        click("abrir-move")
        click("tab:DES-1")
        click("cerrar:DES-1")
        expect(screen.getByText("open:sales.saleorder:42")).toBeInTheDocument()
        click("tab:MOV-7")
        click("cerrar:MOV-7")
        expect(screen.getByText("open:sales.saleorder:42")).toBeInTheDocument()
        click("x")
        expect(screen.queryByText(/open:/)).toBeNull()
        expect(screen.queryAllByText(/^tab:/)).toHaveLength(0)
    })

    it("X on the drawer closes only the active tab; saving closes it too", () => {
        setup()
        click("abrir-despacho")
        click("abrir-move")
        click("x")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        click("abrir-move")
        click("guardado")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
    })

    it("names a tab once the sheet knows its number", () => {
        setup()
        click("abrir-ov")
        click("nombrar-ov")
        expect(screen.getByText("tab:OV-000042*")).toBeInTheDocument()
    })

    it("opens the cost calculator as a tool tab that keeps living while another tab is active", async () => {
        setup()
        click("abrir-despacho")
        click("abrir-calculadora")
        expect(await screen.findByText("calculadora:abierta")).toBeInTheDocument()
        click("tab:DES-1")
        expect(await screen.findByText("calculadora:oculta")).toBeInTheDocument()
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        click("cerrar:Calculadora de Costos")
        expect(screen.queryByText(/calculadora:/)).toBeNull()
    })

    it("closes every tab when the page changes", () => {
        const { rerender } = setup()
        click("abrir-despacho")
        click("abrir-calculadora")
        nav.pathname = "/inventory/products"
        rerender(<GlobalModalProvider><Controls /></GlobalModalProvider>)
        expect(screen.queryAllByText(/^tab:/)).toHaveLength(0)
        expect(screen.queryByText(/open:/)).toBeNull()
        expect(screen.queryByText(/calculadora:/)).toBeNull()
    })

    it("closeEntity clears every tab", () => {
        setup()
        click("abrir-despacho")
        click("abrir-move")
        click("cerrar-todo")
        expect(screen.queryByText(/open:/)).toBeNull()
    })

    it("flags the document's module in the tab description only when it differs from the page's", () => {
        setup() // la página está en /sales/...
        click("abrir-despacho")
        click("abrir-move") // inventory.stockmove vive en Inventario
        expect(screen.getByText(/^desc:.*MOV-7.*Inventario/)).toBeInTheDocument()
        click("abrir-ov") // sales.saleorder vive en Ventas = módulo de la página
        expect(screen.getByText(/^desc:.*OV-42$/)).toBeInTheDocument()
    })
})

/** Guarda estricta: un formulario sucio bloquea abrir, cambiar de pestaña, cerrar y salir hasta decidir. */
describe("GlobalModalProvider unsaved-changes guard", () => {
    function DirtyForm({ save = async () => true }: { save?: () => Promise<boolean> }) {
        const { registerDirty } = useGlobalModals()
        const state = React.useRef({ dirty: true, discarded: 0 })
        useEffect(() => registerDirty({
            name: "OV-1",
            isDirty: () => state.current.dirty,
            discard: () => { state.current.dirty = false; state.current.discarded++ },
            save: async () => { const ok = await save(); if (ok) state.current.dirty = false; return ok },
        }), [registerDirty, save])
        return null
    }

    const setupDirty = (save?: () => Promise<boolean>) => render(
        <GlobalModalProvider>
            <Controls />
            <DirtyForm save={save} />
            <Link href="/inventory/products">ir-a-inventario</Link>
        </GlobalModalProvider>
    )

    it("blocks opening another document until the user decides (keep editing cancels)", async () => {
        setupDirty()
        click("abrir-despacho")
        expect(screen.queryByText(/open:/)).toBeNull()
        expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument()
        expect(screen.getByText("OV-1")).toBeInTheDocument()

        click("Seguir editando")
        await waitFor(() => expect(screen.queryByText("Cambios sin guardar")).toBeNull())
        expect(screen.queryByText(/open:/)).toBeNull()
    })

    it("discard continues with the pending open", async () => {
        setupDirty()
        click("abrir-despacho")
        click("Descartar y continuar")
        expect(await screen.findByText("open:sales.saledelivery:1")).toBeInTheDocument()
    })

    it("save continues only when the form was saved", async () => {
        const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        setupDirty(save)

        click("abrir-despacho")
        click("Guardar y continuar")
        await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.queryByText("Cambios sin guardar")).toBeNull())
        expect(screen.queryByText(/open:/)).toBeNull() // validación fallida: no continúa

        click("abrir-despacho")
        click("Guardar y continuar")
        expect(await screen.findByText("open:sales.saledelivery:1")).toBeInTheDocument()
    })

    it("asks before an internal link leaves the page and goes there only after the user decides", async () => {
        setupDirty()
        click("ir-a-inventario")
        expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument()
        expect(nav.push).not.toHaveBeenCalled()

        click("Descartar y continuar")
        await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/inventory/products"))
    })
})
