import { render, screen, act, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React, { useEffect } from "react"

import { GlobalModalProvider, useGlobalModals } from "../GlobalModalProvider"
import { useEntityNavigation } from "@/components/shared"
import { Button } from "@/components/ui/button"

vi.mock("next/navigation", () => ({ usePathname: () => "/sales/orders" }))

// Drawer de prueba: muestra qué documento está abierto y el "volver" disponible.
function FakeDrawer({ label, id, onOpenChange }: { label: string; id: number; onOpenChange?: (open: boolean) => void }) {
    const navigation = useEntityNavigation()
    return (
        <div>
            <span>open:{label}:{id}</span>
            <Button onClick={() => onOpenChange?.(false)}>x</Button>
            {navigation && <Button onClick={navigation.goBack}>volver:{navigation.backLabel}</Button>}
            {navigation && <span>modulo:{navigation.module?.label ?? "ninguno"}</span>}
            {navigation && navigation.trail.map((item) => (
                <Button key={item.key} onClick={item.onSelect}>miga:{item.label}</Button>
            ))}
        </div>
    )
}

vi.mock("@/lib/entity-drawers", () => {
    const render = (label: string) => function EntityDrawerStub({ id, onOpenChange }: { id: number; onOpenChange?: (open: boolean) => void }) {
        return <FakeDrawer label={label} id={id} onOpenChange={onOpenChange} />
    }
    const drawers: Record<string, unknown> = {
        "sales.saledelivery": render("sales.saledelivery"),
        "inventory.stockmove": render("inventory.stockmove"),
        "sales.saleorder": render("sales.saleorder"),
        "purchasing.purchaseorder": render("purchasing.purchaseorder"),
    }
    return { ENTITY_DRAWERS: drawers, hasEntityDrawer: (label: string) => label in drawers }
})

/** Botones que disparan las acciones del provider. */
function Controls() {
    const { openEntity, closeEntity, setEntityDisplay } = useGlobalModals()
    return (
        <div>
            <Button onClick={() => openEntity("sales.saledelivery", 1, undefined, undefined, { display: "DES-1" })}>abrir-despacho</Button>
            <Button onClick={() => openEntity("inventory.stockmove", 7)}>abrir-move</Button>
            <Button onClick={() => openEntity("sales.saleorder", 42)}>abrir-ov</Button>
            <Button onClick={() => openEntity("purchasing.purchaseorder", 9)}>abrir-oc</Button>
            <Button onClick={() => setEntityDisplay("sales.saleorder", 42, "OV-000042")}>nombrar-ov</Button>
            <Button onClick={closeEntity}>cerrar</Button>
        </div>
    )
}

const setup = () => render(
    <GlobalModalProvider>
        <Controls />
    </GlobalModalProvider>
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

    it("builds a trail and pops to a previous document from the breadcrumb (ADR-0100)", () => {
        setup()
        click("abrir-despacho")
        click("abrir-ov")
        click("abrir-move")
        expect(screen.getByText("miga:DES-1")).toBeInTheDocument()
        click("miga:DES-1")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        expect(screen.queryByText(/miga:/)).toBeNull()
    })

    it("shows the document module only when it differs from the page module", () => {
        setup() // la página está en /sales/...
        click("abrir-despacho")
        click("abrir-move") // inventory.stockmove vive en Inventario
        expect(screen.getByText("modulo:Inventario")).toBeInTheDocument()
        click("abrir-ov") // sales.saleorder vive en Ventas = módulo de la página
        expect(screen.getByText("modulo:ninguno")).toBeInTheDocument()
    })

    it("closeEntity clears the whole stack and re-opening the top is a no-op", () => {
        setup()
        click("abrir-despacho")
        click("abrir-despacho")
        expect(screen.queryByText(/volver:/)).toBeNull()
        click("cerrar")
        expect(screen.queryByText(/open:/)).toBeNull()
    })

    it("closing with X pops one level and only closes at the last document (ADR-0100)", () => {
        setup()
        click("abrir-despacho")
        click("abrir-ov")
        click("abrir-move")
        click("x")
        expect(screen.getByText("open:sales.saleorder:42")).toBeInTheDocument()
        click("x")
        expect(screen.getByText("open:sales.saledelivery:1")).toBeInTheDocument()
        click("x")
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
    })

    it("opens purchase orders in their document sheet too (U3)", () => {
        setup()
        click("abrir-despacho")
        click("abrir-oc")
        expect(screen.getByText("open:purchasing.purchaseorder:9")).toBeInTheDocument()
        expect(screen.getByText("volver:DES-1")).toBeInTheDocument()
    })
})


/** Guarda estricta: un formulario sucio bloquea abrir, volver y cerrar hasta decidir. */
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
})
