import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const refetch = vi.fn()

vi.mock("@/features/treasury", () => ({
    useTerminalSyncSettings: () => ({ settings: undefined, isLoading: false, isError: true, refetch }),
    useUpdateTerminalSyncSettings: () => ({ updateSettings: vi.fn(), isUpdating: false }),
    useTerminalProviders: () => ({ providers: [] }),
    useTerminalSyncRuns: () => ({ runs: [], totalCount: 0, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }),
    terminalSyncRunEntity: {},
    terminalSyncRunViews: {},
    terminalSyncRunStatus: vi.fn(),
}))

import { TreasurySettingsView } from "../TreasurySettingsView"

describe("TreasurySettingsView", () => {
    it("shows an error state with retry when settings fail to load", () => {
        render(<TreasurySettingsView />)
        expect(screen.getByText("No se pudo cargar la configuración del terminal de cobro")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})
