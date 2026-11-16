import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const setClock = vi.fn()
const resetClock = vi.fn()
const state = vi.hoisted(() => ({
    allowed: true,
    isLoading: false,
    isError: false,
    clock: { active: false, now: "2026-11-15T12:00:00-03:00", offset_seconds: 0 } as unknown,
}))

vi.mock("../../hooks/useDebugToolsAccess", () => ({ useDebugToolsAccess: () => state.allowed }))
vi.mock("../../hooks/useDebugClock", () => ({
    useDebugClock: () => ({
        clock: state.clock,
        isLoading: state.isLoading,
        isError: state.isError,
        refetch: vi.fn(),
        setClock,
        resetClock,
        isSaving: false,
    }),
}))

import { DebugSettingsView } from "../DebugSettingsView"

describe("DebugSettingsView", () => {
    beforeEach(() => {
        setClock.mockReset()
        resetClock.mockReset()
        state.allowed = true
        state.isLoading = false
        state.isError = false
        state.clock = { active: false, now: "2026-11-15T15:00:00+00:00", offset_seconds: 0 }
    })

    it("fijar hora llama a la mutación con el valor del campo", async () => {
        setClock.mockResolvedValue(undefined)
        const { container } = render(<DebugSettingsView />)
        const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement
        fireEvent.change(input, { target: { value: "2026-11-13T17:35" } })
        fireEvent.click(screen.getByRole("button", { name: "Fijar hora" }))
        await waitFor(() => expect(setClock).toHaveBeenCalledWith("2026-11-13T17:35"))
    })

    it("no llama a la mutación con el campo vacío y muestra el error", async () => {
        const { container } = render(<DebugSettingsView />)
        expect(container.querySelector('input[type="datetime-local"]')).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Fijar hora" }))
        await waitFor(() => expect(screen.getByText("Ingrese fecha y hora")).toBeTruthy())
        expect(setClock).not.toHaveBeenCalled()
    })

    it("volver a la hora real llama a resetClock", async () => {
        resetClock.mockResolvedValue(undefined)
        state.clock = { active: true, now: "2026-11-13T20:35:00+00:00", offset_seconds: -172800 }
        render(<DebugSettingsView />)
        expect(screen.getByText("Reloj alterado")).toBeTruthy()
        expect(screen.getByText("13-11-2026 17:35")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Volver a la hora real" }))
        await waitFor(() => expect(resetClock).toHaveBeenCalledTimes(1))
    })

    it("muestra carga", () => {
        state.isLoading = true
        state.clock = undefined
        const { container } = render(<DebugSettingsView />)
        expect(container.querySelector('[data-testid="debug-clock-loading"]')).toBeTruthy()
    })

    it("muestra error", () => {
        state.isError = true
        state.clock = undefined
        render(<DebugSettingsView />)
        expect(screen.getByText("No se pudo leer el reloj de depuración")).toBeTruthy()
    })

    it("sin acceso muestra el estado vacío", () => {
        state.allowed = false
        render(<DebugSettingsView />)
        expect(screen.getByText("Herramientas de depuración no disponibles")).toBeTruthy()
    })
})
