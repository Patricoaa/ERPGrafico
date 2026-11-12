import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"

import { TaxDeclarationsClientView } from "../TaxDeclarationsClientView"

const m = vi.hoisted(() => ({
    refetch: vi.fn(),
    close: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/tax",
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ serverDate: null, dateString: "2026-11-12" }) }))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({ close: m.close, selectedId: 7, tab: {}, open: true }),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ children }: { children: (open: boolean) => React.ReactNode }) => <>{children(true)}</>,
}))
vi.mock("@/components/entity-view", () => ({
    Collection: Object.assign(({ children }: { children: React.ReactNode }) => <>{children}</>, {
        Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        Toolbar: () => null,
        View: () => null,
    }),
    useCollectionViewMode: () => ({ view: "card", onViewChange: vi.fn() }),
    useEntityCollection: () => ({}),
}))
vi.mock("@/components/shared", () => ({
    SkeletonShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    UnifiedSearchBar: () => null,
    bindUnifiedSearch: () => ({}),
    useUnifiedSearch: () => ({ filterFn: (x: unknown[]) => x, isFiltered: false, clearAll: vi.fn() }),
    createEntityActions: () => ({ forCollection: () => ({}) }),
}))
vi.mock("../../entity-view/taxPeriod.entity", () => ({ taxPeriodEntity: {}, taxPeriodViews: {} }))
vi.mock("../../hooks/useTaxQueries", () => ({
    useTaxPeriods: () => ({ taxPeriods: { results: [] }, isLoading: false, isError: false, refetch: m.refetch }),
}))
vi.mock("@/features/tax/components/DeclarationWizard", () => ({
    DeclarationWizard: ({ onSuccess }: { onSuccess: () => void }) => <button onClick={onSuccess}>finalizar</button>,
}))

describe("TaxDeclarationsClientView", () => {
    it("al finalizar el wizard refresca los períodos y cierra el panel", () => {
        render(<TaxDeclarationsClientView />)
        fireEvent.click(screen.getByText("finalizar"))
        expect(m.refetch).toHaveBeenCalled()
        expect(m.close).toHaveBeenCalled()
    })
})
