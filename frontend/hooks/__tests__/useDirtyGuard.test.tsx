import { render, screen, act, waitFor, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"
import { useForm } from "react-hook-form"

import { GlobalModalProvider, useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useInitializeDrawerForm } from "../useInitializeDrawerForm"

vi.mock("next/navigation", () => ({ usePathname: () => "/x", useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/entity-drawers", () => ({ ENTITY_DRAWERS: {}, hasEntityDrawer: () => false }))

interface Values { name: string }

function FormDrawer({ onSubmitSpy, onRender, named = true }: { onSubmitSpy: (v: Values) => void; onRender?: () => void; named?: boolean }) {
    React.useEffect(() => { onRender?.() })
    const form = useForm<Values>({ defaultValues: { name: "" } })
    useInitializeDrawerForm<{ id: number; name: string }, Values>({
        form, open: true, initialData: { id: 1, name: "Original" }, defaultValues: { name: "" }, guardName: named ? "Cliente 1" : undefined,
    })
    return (
        <form onSubmit={form.handleSubmit((v) => { onSubmitSpy(v); form.reset(v) })}>
            <input aria-label="nombre" {...form.register("name")} />
        </form>
    )
}

/** Dos guardas encadenadas (drawer propio + pila) no deben preguntar dos veces tras descartar. */
function ChainedOpener() {
    const { runGuarded } = useGlobalModals()
    const [log, setLog] = React.useState("")
    return (
        <button onClick={() => runGuarded(() => runGuarded(() => setLog("closed")))}>cadena:{log}</button>
    )
}

function Opener() {
    const { requestLeave } = useGlobalModals()
    const [result, setResult] = React.useState("none")
    return <button onClick={() => { void requestLeave().then((ok) => setResult(ok ? "continue" : "cancel")) }}>salir:{result}</button>
}

/** Como un drawer real: guarda (API) y se cierra vía la guarda (`panel.close()`), sin `form.reset()`. */
function ClosingDrawer({ fail = false }: { fail?: boolean }) {
    const { runGuarded } = useGlobalModals()
    const [closed, setClosed] = React.useState(false)
    const form = useForm<Values>({ defaultValues: { name: "" } })
    useInitializeDrawerForm<{ id: number; name: string }, Values>({
        form, open: !closed, initialData: { id: 1, name: "Original" }, defaultValues: { name: "" },
    })
    const onSubmit = async () => {
        await Promise.resolve()
        if (fail) return
        runGuarded(() => setClosed(true))
    }
    return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <input aria-label="nombre" {...form.register("name")} />
            <button type="submit">guardar</button>
            <span>estado:{closed ? "cerrado" : "abierto"}</span>
            <Opener />
        </form>
    )
}

const setup = (spy = vi.fn(), onRender?: () => void, named = true) => render(
    <GlobalModalProvider>
        <FormDrawer onSubmitSpy={spy} onRender={onRender} named={named} />
        <Opener />
        <ChainedOpener />
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

    it("discarding once does not trigger a second dialog in a chained guard", async () => {
        setup()
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))

        act(() => screen.getByText("cadena:").click())
        act(() => screen.getByText("Descartar y continuar").click())

        expect(await screen.findByText("cadena:closed")).toBeInTheDocument()
        expect(screen.queryByText("Cambios sin guardar")).toBeNull()
    })

    it("a successful save closes its own panel without the unsaved-changes dialog", async () => {
        render(<GlobalModalProvider><ClosingDrawer /></GlobalModalProvider>)
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))
        act(() => screen.getByText("guardar").click())
        expect(await screen.findByText("estado:cerrado")).toBeInTheDocument()
        expect(screen.queryByText("Cambios sin guardar")).toBeNull()
    })

    it("still guards the changes after a failed save", async () => {
        render(<GlobalModalProvider><ClosingDrawer fail /></GlobalModalProvider>)
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))
        await act(async () => { screen.getByText("guardar").click() })
        act(() => screen.getByText("salir:none").click())
        expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument()
    })

    it("falls back to the record name from initialData when no guardName is given", async () => {
        setup(vi.fn(), undefined, false)
        fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Cambiado" } })
        await waitFor(() => expect(screen.getByLabelText("nombre")).toHaveValue("Cambiado"))
        act(() => screen.getByText("salir:none").click())
        expect(await screen.findByText("Original")).toBeInTheDocument()
    })
})
