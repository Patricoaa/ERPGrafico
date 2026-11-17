import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const refetch = vi.fn()
const state = vi.hoisted(() => ({ settings: undefined as unknown, isError: true }))

vi.mock("@/features/treasury", () => ({
    useTerminalSyncSettings: () => ({ settings: state.settings, isLoading: false, isError: state.isError, refetch }),
    useUpdateTerminalSyncSettings: () => ({ updateSettings: vi.fn(), isUpdating: false }),
    useTerminalProviders: () => ({ providers: [] }),
}))

vi.mock("@/hooks/useAutoSaveForm", () => ({
    useAutoSaveForm: () => ({ status: "idle", invalidReason: null, lastSavedAt: null, retry: vi.fn() }),
}))
vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: vi.fn() }))

import { TreasurySettingsView } from "../TreasurySettingsView"

describe("TreasurySettingsView", () => {
    it("shows an error state with retry when settings fail to load", () => {
        render(<TreasurySettingsView />)
        expect(screen.getByText("No se pudo cargar la configuración del terminal de cobro")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })

    it("el panel cargado desplaza su contenido internamente dentro del layout del módulo", () => {
        state.settings = {
            id: 1, enabled: false, interval_value: 1, interval_unit: "DAYS", run_hour: 3, lookback_days: 7, history_start_date: null,
            max_retries: 3, retry_delay_minutes: 10, last_run: null,
        }
        state.isError = false
        const { container } = render(<TreasurySettingsView />)
        const scroller = container.firstElementChild
        expect(scroller?.className).toEqual(expect.stringContaining("overflow-y-auto"))
        expect(scroller?.className).toEqual(expect.stringContaining("min-h-0"))
        expect(scroller?.className).toEqual(expect.stringContaining("flex-1"))
        expect(screen.getByText("Sincronización automática", { selector: "div,h3,[data-slot=card-title]" })).toBeTruthy()
        expect(screen.queryByText("Última ejecución")).toBeNull()
        expect(screen.queryByText("Últimas ejecuciones")).toBeNull()
        expect(screen.getByRole("link", { name: "Terminal de cobro → Importaciones" })).toHaveAttribute("href", "/treasury/terminal-cobro/imports")
    })

    it("muestra la hora de ejecución solo cuando la unidad es Días", () => {
        const base = {
            id: 1, enabled: false, interval_value: 1, interval_unit: "DAYS" as const, run_hour: 3, lookback_days: 7,
            history_start_date: null, max_retries: 3, retry_delay_minutes: 10, last_run: null,
        }
        state.settings = base
        state.isError = false
        const days = render(<TreasurySettingsView />)
        expect(screen.getByText("Hora de ejecución")).toBeTruthy()
        expect(screen.getByText("Cada")).toBeTruthy()
        expect(screen.getByText("Unidad")).toBeTruthy()
        days.unmount()
        state.settings = { ...base, interval_unit: "MINUTES", interval_value: 30 }
        render(<TreasurySettingsView />)
        expect(screen.queryByText("Hora de ejecución")).toBeNull()
    })
})
