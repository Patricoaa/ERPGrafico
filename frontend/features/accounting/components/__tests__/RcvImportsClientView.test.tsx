import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import type { RcvImport } from "../../types"

const m = vi.hoisted(() => ({
    rows: [] as unknown[],
    canAdd: true,
    useRcvImports: vi.fn(),
    filters: {} as Record<string, string>,
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/accounting/rcv/imports",
}))
vi.mock("@/hooks/useViewMode", () => ({ useViewMode: () => ({ currentView: "list", handleViewChange: vi.fn() }) }))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({
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
        permission === "accounting.add_rcvimport" && m.canAdd ? <>{children}</> : null,
}))
vi.mock("../rcv/RcvImportDrawer", () => ({ RcvImportDrawer: () => null }))
vi.mock("../rcv/RcvImportModal", () => ({ RcvImportModal: () => null }))
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
vi.mock("../../hooks/useRcvImports", () => ({
    useRcvImports: (filters: unknown) => {
        m.useRcvImports(filters)
        return { page: { count: m.rows.length, results: m.rows }, imports: m.rows, totalCount: m.rows.length, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }
    },
}))

import { RcvImportsClientView } from "../rcv/RcvImportsClientView"

const row: RcvImport = {
    id: 1, direction: "PURCHASES", year: 2026, month: 10, period: "2026-10", trigger: "SCHEDULED", status: "SUCCESS",
    triggered_by: null, triggered_by_name: null, started_at: "2026-11-14T10:00:00-03:00", finished_at: "2026-11-14T10:02:03-03:00",
    error_code: "", error_message: "", warnings: [], received_count: 12, created_count: 10, updated_count: 2, missing_count: 0,
    api_key: 1, masked_key: "••••4472", created_at: "2026-11-14T10:00:00-03:00",
}

describe("RcvImportsClientView", () => {
    beforeEach(() => {
        m.rows = []
        m.canAdd = true
        m.filters = {}
        m.useRcvImports.mockClear()
    })

    it("muestra período, estado, key enmascarada y duración", () => {
        m.rows = [row]
        render(<RcvImportsClientView />)
        expect(screen.getByText("Octubre 2026")).toBeInTheDocument()
        expect(screen.getByText("Exitosa")).toBeInTheDocument()
        expect(screen.getByText("••••4472")).toBeInTheDocument()
        expect(screen.getByText("2:03")).toBeInTheDocument()
    })

    it("con permiso muestra 'Sincronizar ahora'", () => {
        m.rows = [row]
        render(<RcvImportsClientView />)
        expect(screen.getByRole("button", { name: /Sincronizar ahora/ })).toBeInTheDocument()
    })

    it("sin permiso oculta 'Sincronizar ahora' (también en el estado vacío)", () => {
        m.canAdd = false
        const { unmount } = render(<RcvImportsClientView />)
        expect(screen.getByText("Aún no hay importaciones")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Sincronizar ahora/ })).not.toBeInTheDocument()
        unmount()
        m.rows = [row]
        render(<RcvImportsClientView />)
        expect(screen.queryByRole("button", { name: /Sincronizar ahora/ })).not.toBeInTheDocument()
    })

    it("traduce los filtros de la URL a filtros de la API e ignora valores inválidos", () => {
        m.filters = { direction: "SALES", status: "FAILED", trigger: "MANUAL", year: "2026", month: "10" }
        const { unmount } = render(<RcvImportsClientView />)
        expect(m.useRcvImports).toHaveBeenCalledWith(
            expect.objectContaining({ direction: "SALES", status: "FAILED", trigger: "MANUAL", year: 2026, month: 10, page: 1 }),
        )
        unmount()
        m.filters = { status: "BOGUS" }
        render(<RcvImportsClientView />)
        expect(m.useRcvImports).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }))
    })
})
