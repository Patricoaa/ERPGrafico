import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const updateSettings = vi.fn()
const state = vi.hoisted(() => ({
    settings: undefined as unknown,
    apiKeys: [] as unknown[],
    permissions: true,
}))

vi.mock("@/features/accounting", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/accounting")>(),
    useRcvSettings: () => ({ settings: state.settings, isLoading: false, isError: false, refetch: vi.fn() }),
    useUpdateRcvSettings: () => ({ updateSettings, isUpdating: false }),
    useRcvApiKeys: () => ({ apiKeys: state.apiKeys, isLoading: false, isError: false, refetch: vi.fn() }),
    useRcvApiKeyMutations: () => ({
        create: vi.fn(), update: vi.fn(), remove: vi.fn(), isCreating: false, isUpdating: false, isRemoving: false,
    }),
}))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: () => state.permissions }) }))
vi.mock("@/hooks/useAutoSaveForm", () => ({
    useAutoSaveForm: () => ({ status: "idle", invalidReason: null, lastSavedAt: null, retry: vi.fn() }),
}))
vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: vi.fn() }))

import { RcvSettingsView } from "../RcvSettingsView"

const baseSettings = {
    company_rut: "11.111.111-1",
    user_rut: "",
    has_sii_password: true,
    enabled: true,
    interval_days: 7,
    run_hour: 6,
    include_purchases: true,
    include_sales: true,
    next_period: { year: 2026, month: 10 },
    estimated_monthly_queries: 8,
    fiscal_match_start_date: "2026-10-01",
    terminal_match_window_minutes: 15,
}

const apiKey = {
    id: 1, label: "Principal", masked_key: "••••-4472", is_active: true, used_this_month: 3,
    exhausted_until: null, last_used_at: null, last_error: "",
}

describe("RcvSettingsView", () => {
    beforeEach(() => {
        updateSettings.mockReset()
        state.settings = baseSettings
        state.apiKeys = [apiKey]
        state.permissions = true
    })

    it("con clave configurada muestra 'Configurada' y ningún input de clave con valor", () => {
        const { container } = render(<RcvSettingsView />)
        expect(screen.getByText("Configurada")).toBeTruthy()
        expect(container.querySelector('input[type="password"]')).toBeNull()
        expect(screen.getByText("Si corriera hoy consultaría Octubre 2026")).toBeTruthy()
    })

    it("al cambiar la clave guarda solo sii_password, limpia el input y deshabilita el botón vacío", async () => {
        updateSettings.mockResolvedValue(undefined)
        const { container } = render(<RcvSettingsView />)
        fireEvent.click(screen.getByRole("button", { name: "Cambiar" }))
        const input = container.querySelector('input[type="password"]') as HTMLInputElement
        expect(input.value).toBe("")
        const save = screen.getByRole("button", { name: "Guardar clave" }) as HTMLButtonElement
        expect(save.disabled).toBe(true)
        fireEvent.change(input, { target: { value: "   " } })
        expect(save.disabled).toBe(true)
        fireEvent.change(input, { target: { value: "clave-de-prueba" } })
        expect(save.disabled).toBe(false)
        fireEvent.click(save)
        await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ sii_password: "clave-de-prueba" }))
        await waitFor(() => expect(screen.getByText("Configurada")).toBeTruthy())
        expect(container.querySelector('input[type="password"]')).toBeNull()
    })

    it("muestra el consumo estimado sin cupo interno", () => {
        state.settings = { ...baseSettings, estimated_monthly_queries: 12 }
        render(<RcvSettingsView />)
        expect(screen.getByText("Consumo estimado: 12 consultas/mes")).toBeTruthy()
        expect(screen.queryByText(/cupo disponible/)).toBeNull()
    })

    it("lista las API keys con su consumo y clave enmascarada", () => {
        render(<RcvSettingsView />)
        expect(screen.getByText("3 este mes")).toBeTruthy()
        expect(screen.getByText("••••-4472")).toBeTruthy()
    })

    it("explica la rotación de keys por menor uso", () => {
        render(<RcvSettingsView />)
        expect(screen.getByText(/Se usa primero la key con menos consultas este mes; si SimpleAPI responde que una no tiene cupo, se pasa a la siguiente\./)).toBeTruthy()
    })

    it("sin permisos de escritura no ofrece cambiar la clave ni agregar keys", () => {
        state.permissions = false
        render(<RcvSettingsView />)
        expect(screen.queryByRole("button", { name: "Cambiar" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Agregar API key" })).toBeNull()
    })

    it("muestra la sección Cuadre con la ventana TUU", () => {
        render(<RcvSettingsView />)
        expect(screen.getByText("Cuadre")).toBeTruthy()
        expect(screen.getByText("Fecha de inicio del cuadre")).toBeTruthy()
        const group = screen.getByRole("group", { name: "Ventana del cuadre TUU (minutos)" })
        expect((group.querySelector("input") as HTMLInputElement).value).toBe("15")
    })
})
