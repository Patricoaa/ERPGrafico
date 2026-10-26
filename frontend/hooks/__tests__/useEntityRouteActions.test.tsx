import { render, screen, act, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { useForm } from "react-hook-form"

import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"
import { useEntityRouteActions } from "../useEntityRouteActions"
import { useInitializeDrawerForm } from "../useInitializeDrawerForm"

const { replaceMock, pushMock } = vi.hoisted(() => ({ replaceMock: vi.fn(), pushMock: vi.fn() }))

vi.mock("next/navigation", () => ({
    usePathname: () => "/inventory/warehouses",
    useRouter: () => ({ replace: replaceMock, push: pushMock }),
    useSearchParams: () => new URLSearchParams("selected=5"),
}))
vi.mock("@/lib/entity-drawers", () => ({ ENTITY_DRAWERS: {}, hasEntityDrawer: () => false }))

function PageDrawer() {
    const { clearActions, openSelected } = useEntityRouteActions()
    const form = useForm<{ name: string }>({ defaultValues: { name: "" } })
    useInitializeDrawerForm<{ id: number; name: string }, { name: string }>({
        form, open: true, initialData: { id: 5, name: "Bodega" }, defaultValues: { name: "" },
    })
    return (
        <div>
            <input aria-label="nombre" {...form.register("name")} />
            <button onClick={clearActions}>cerrar</button>
            <button onClick={() => openSelected(9)}>otra-fila</button>
        </div>
    )
}

const setup = () => render(<GlobalModalProvider><PageDrawer /></GlobalModalProvider>)

describe("useEntityRouteActions unsaved-changes guard", () => {
    beforeEach(() => { replaceMock.mockReset(); pushMock.mockReset() })

    it("closes straight away when the form is clean", () => {
        setup()
        act(() => screen.getByText("cerrar").click())
        expect(replaceMock).toHaveBeenCalledWith("/inventory/warehouses", { scroll: false })
    })

    it("asks before closing a dirty page drawer and keeps it open on Seguir editando", async () => {
        setup()
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))

        act(() => screen.getByText("cerrar").click())
        expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument()
        expect(replaceMock).not.toHaveBeenCalled()

        act(() => screen.getByText("Seguir editando").click())
        expect(replaceMock).not.toHaveBeenCalled()
    })

    it("asks before switching to another row and proceeds after discarding", async () => {
        setup()
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))

        act(() => screen.getByText("otra-fila").click())
        expect(pushMock).not.toHaveBeenCalled()
        act(() => screen.getByText("Descartar y continuar").click())
        await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1))
    })
})
