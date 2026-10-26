import { render, screen, act, waitFor, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"
import { useForm } from "react-hook-form"

import { GlobalModalProvider, useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useInitializeDrawerForm } from "../useInitializeDrawerForm"

vi.mock("next/navigation", () => ({ usePathname: () => "/x" }))
vi.mock("@/lib/entity-drawers", () => ({ ENTITY_DRAWERS: {}, hasEntityDrawer: () => false }))

interface Values { name: string }

function FormDrawer({ onSubmitSpy, onRender }: { onSubmitSpy: (v: Values) => void; onRender?: () => void }) {
    React.useEffect(() => { onRender?.() })
    const form = useForm<Values>({ defaultValues: { name: "" } })
    useInitializeDrawerForm<{ id: number; name: string }, Values>({
        form, open: true, initialData: { id: 1, name: "Original" }, defaultValues: { name: "" }, guardName: "Cliente 1",
    })
    return (
        <form onSubmit={form.handleSubmit((v) => { onSubmitSpy(v); form.reset(v) })}>
            <input aria-label="nombre" {...form.register("name")} />
        </form>
    )
}

function Opener() {
    const { requestLeave } = useGlobalModals()
    const [result, setResult] = React.useState("none")
    return <button onClick={() => { void requestLeave().then((ok) => setResult(ok ? "continue" : "cancel")) }}>salir:{result}</button>
}

const setup = (spy = vi.fn(), onRender?: () => void) => render(
    <GlobalModalProvider>
        <FormDrawer onSubmitSpy={spy} onRender={onRender} />
        <Opener />
    </GlobalModalProvider>
)

describe("useDirtyGuard via useInitializeDrawerForm", () => {
    it("does not re-render in a loop and stays clean until the user edits", async () => {
        const onRender = vi.fn()
        setup(vi.fn(), onRender)
        expect(onRender.mock.calls.length).toBeLessThan(10)
        act(() => screen.getByText("salir:none").click())
        expect(await screen.findByText("salir:continue")).toBeInTheDocument()
        expect(screen.queryByText("Cambios sin guardar")).toBeNull()
    })

    it("asks before leaving once edited, and Guardar y continuar submits the form", async () => {
        const spy = vi.fn()
        setup(spy)
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))

        act(() => screen.getByText("salir:none").click())
        expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument()
        expect(screen.getByText("Cliente 1")).toBeInTheDocument()

        act(() => screen.getByText("Guardar y continuar").click())
        await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ name: "Cambiado" })))
        await waitFor(() => expect(screen.getByText("salir:continue")).toBeInTheDocument())
    })

    it("Seguir editando cancels the leave", async () => {
        setup()
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))
        act(() => screen.getByText("salir:none").click())
        act(() => screen.getByText("Seguir editando").click())
        await waitFor(() => expect(screen.getByText("salir:cancel")).toBeInTheDocument())
    })
})
