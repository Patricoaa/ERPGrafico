import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PartnersClientView } from "../PartnersClientView"

const m = vi.hoisted(() => ({
    partners: [] as Array<{ id: number; name: string }>,
    run: vi.fn(),
    openSelected: vi.fn(),
    rootProps: {} as Record<string, unknown>,
}))

vi.mock("next/navigation", () => ({
    usePathname: () => "/finances/partners/composition",
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: () => null,
}))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({ tab: {}, selectedId: null, close: vi.fn() }),
}))
vi.mock("@/hooks/useEntityRouteActions", () => ({
    useEntityRouteActions: () => ({ openSelected: m.openSelected }),
}))
vi.mock("@/features/contacts", () => ({
    usePartners: () => ({ partners: m.partners, isLoading: false, isFetching: false, refetch: vi.fn(), error: null }),
    netEquityPercentages: () => ({}),
}))
vi.mock("../../hooks", () => ({ useOnOpen: vi.fn() }))
vi.mock("../../hooks/usePartnerAnalyticsData", () => ({ usePartnerAnalyticsData: () => ({}) }))
vi.mock("../../hooks/usePartnerEvolutionData", () => ({ usePartnerEvolutionData: () => ({}) }))
vi.mock("../partnerAnalyticsScreen", () => ({ buildPartnerAnalyticsScreen: () => ({}) }))
vi.mock("../../entity-view/partner.entity", () => ({ partnerEntity: {}, partnerViews: { table: {}, card: {} } }))
vi.mock("../PartnerActionModal", () => ({ usePartnerActions: () => ({ run: m.run, host: null }) }))
vi.mock("../PartnerDrawer", () => ({ PartnerDrawer: () => null }))
vi.mock("@/components/shared", () => ({
    AnalyticsPanelContent: () => null,
    UnifiedSearchBar: () => null,
    bindUnifiedSearch: () => ({}),
    useUnifiedSearch: () => ({ filterFn: (rows: unknown[]) => rows, filters: {}, isFiltered: false, clearAll: vi.fn() }),
}))
vi.mock("@/components/entity-view", () => {
    const Root = ({ children, onOpen, ...rest }: { children: ReactNode; onOpen: (p: { id: number }) => void } & Record<string, unknown>) => {
        m.rootProps = { ...rest, onOpen }
        return <div>{children}</div>
    }
    const Toolbar = ({ action }: { action?: ReactNode }) => <div role="toolbar">{action}</div>
    const View = ({ emptyAction }: { emptyAction?: ReactNode }) => (
        <div>
            {m.partners.map(p => (
                <button key={p.id} onClick={() => (m.rootProps.onOpen as (p: { id: number }) => void)(p)}>{p.name}</button>
            ))}
            {m.partners.length === 0 && <div data-testid="empty">{emptyAction}</div>}
        </div>
    )
    return {
        Collection: Object.assign(Root, { Root, Toolbar, View, Analytics: () => null }),
        useCollectionViewMode: () => ({ view: "table", onViewChange: vi.fn() }),
        useEntityCollection: () => ({}),
    }
})

const createAction = <button>Añadir Socio</button>

beforeEach(() => {
    m.run.mockClear()
    m.openSelected.mockClear()
    m.rootProps = {}
    m.partners = [{ id: 7, name: "Ana Socia" }]
})

describe("PartnersClientView", () => {
    it("con socios la barra tiene Añadir y Transferencia, sin Suscripción ni Aporte", async () => {
        render(<PartnersClientView createAction={createAction} />)
        expect(screen.getByRole("button", { name: "Añadir Socio" })).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Transferencia/ }))
        expect(m.run).toHaveBeenCalledWith({ type: "transfer" })
        expect(screen.queryByText(/Nueva Suscripción/)).toBeNull()
        expect(screen.queryByText(/Registrar Aporte/)).toBeNull()
    })

    it("clic en una fila abre la ficha y no hay menú de acciones por fila", async () => {
        render(<PartnersClientView createAction={createAction} />)
        await userEvent.click(screen.getByRole("button", { name: "Ana Socia" }))
        expect(m.openSelected).toHaveBeenCalledWith(7)
        expect(m.rootProps.actions).toBeUndefined()
    })

    it("sin socios hay un único botón de añadir y no hay Transferencia", () => {
        m.partners = []
        render(<PartnersClientView createAction={createAction} />)
        expect(screen.getAllByRole("button", { name: /Añadir/i })).toHaveLength(1)
        expect(screen.queryByRole("button", { name: /Transferencia/ })).toBeNull()
    })
})
