import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import type { TerminalSyncRun } from "../../types"

const m = vi.hoisted(() => ({
    rows: [] as unknown[],
    canAdd: true,
    useTerminalSyncRuns: vi.fn(),
    filters: {} as Record<string, string>,
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/treasury/terminal-cobro/imports",
}))
vi.mock("@/hooks/useViewMode", () => ({ useViewMode: () => ({ currentView: "list", handleViewChange: vi.fn() }) }))
vi.mock("@/hooks/useCreatePanelRoute", () => ({
    useCreatePanelRoute: () => ({
        selectedId: null,
        open: false,
        close: vi.fn(),
        tab: { id: null, open: false, onClose: vi.fn() },
    }),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ label, open, children }: { label: string; open: boolean; children: (open: boolean) => React.ReactNode }) => (
        <div data-testid={`panel-tab-${label}`}>{children(open)}</div>
    ),
}))
vi.mock("@/components/auth", () => ({
    Can: ({ permission, children }: { permission: string; children: React.ReactNode }) =>
        permission === "treasury.add_terminalsyncrun" && m.canAdd ? <>{children}</> : null,
}))
vi.mock("../TerminalSyncRunDrawer", () => ({ TerminalSyncRunDrawer: () => null }))
vi.mock("../TerminalSyncModal", () => ({ TerminalSyncModal: () => null }))
vi.mock("../../hooks/useTerminalProviders", () => ({ useTerminalProviders: () => ({ providers: [] }) }))
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: () => ({
            filters: m.filters,
            isFiltered: Object.keys(m.filters).length > 0,
            applyFilter: vi.fn(),
            clearAll: vi.fn(),
        }),
        bindUnifiedSearch: () => ({}),
    }
})
vi.mock("../../hooks/useTerminalSync", () => ({
    useTerminalSyncRuns: (filters: unknown) => {
        m.useTerminalSyncRuns(filters)
        return { page: { count: m.rows.length, results: m.rows }, runs: m.rows, totalCount: m.rows.length, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }
    },
}))

import { TerminalSyncRunsClientView } from "../TerminalSyncRunsClientView"

const row: TerminalSyncRun = {
    id: 1, provider: 2, provider_name: "TUU Imprenta", trigger: "SCHEDULED", status: "PARTIAL",
    start_date: "2026-11-10", end_date: "2026-11-16", attempts: 1,
    started_at: "2026-11-17T10:00:00-03:00", finished_at: "2026-11-17T10:01:05-03:00",
    error_message: "", warnings: ["Tramo 2 sin respuesta"], fetched_count: 40, created_count: 30, updated_count: 10,
    triggered_by: null, triggered_by_name: null,
}

describe("TerminalSyncRunsClientView", () => {
    beforeEach(() => {
        m.rows = []
        m.canAdd = true
        m.filters = {}
        m.useTerminalSyncRuns.mockClear()
    })

    it("muestra proveedor, estado, conteos y duración de cada importación", () => {
        m.rows = [row]
        render(<TerminalSyncRunsClientView />)
        expect(screen.getByText("TUU Imprenta")).toBeInTheDocument()
        expect(screen.getByText("Parcial")).toBeInTheDocument()
        expect(screen.getByText("Automática")).toBeInTheDocument()
        expect(screen.getByText("1:05")).toBeInTheDocument()
        expect(screen.getByText("1 aviso(s): Tramo 2 sin respuesta")).toBeInTheDocument()
    })

    it("con permiso muestra 'Sincronizar ahora'; sin permiso lo oculta", () => {
        m.rows = [row]
        const { unmount } = render(<TerminalSyncRunsClientView />)
        expect(screen.getByRole("button", { name: /Sincronizar ahora/ })).toBeInTheDocument()
        unmount()
        m.canAdd = false
        render(<TerminalSyncRunsClientView />)
        expect(screen.queryByRole("button", { name: /Sincronizar ahora/ })).not.toBeInTheDocument()
    })

    it("sin filas muestra el estado vacío", () => {
        render(<TerminalSyncRunsClientView />)
        expect(screen.getByText("Aún no hay importaciones")).toBeInTheDocument()
    })

    it("traduce los filtros de la URL a filtros de la API e ignora valores inválidos", () => {
        m.filters = { provider: "2", status: "FAILED", trigger: "MANUAL" }
        const { unmount } = render(<TerminalSyncRunsClientView />)
        expect(m.useTerminalSyncRuns).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 2, status: "FAILED", trigger: "MANUAL", page: 1, page_size: 50 }),
        )
        unmount()
        m.filters = { status: "BOGUS", provider: "x" }
        render(<TerminalSyncRunsClientView />)
        expect(m.useTerminalSyncRuns).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined, provider: undefined }))
    })
})
