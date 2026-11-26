import { render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BudgetsClientView } from "../BudgetsClientView"
import { useBudgetDetailData, type Budget } from "../../hooks/useBudgets"

const m = vi.hoisted(() => ({
    rows: [] as Budget[],
    count: 0,
    navQuery: "",
    selectedEntity: null as Budget | null,
    query: {
        params: {} as Record<string, string>,
        sorting: { mode: "server", state: null, onChange: vi.fn() },
        search: {
            isFiltered: false,
            applyFilter: vi.fn(),
            clearAll: vi.fn(),
        },
    },
    openEntity: vi.fn(),
    replace: vi.fn(),
    deepLink: vi.fn(),
    getBudgets: vi.fn(),
    getBudgetDetail: vi.fn(),
    getBudgetExecution: vi.fn(),
    collectionProps: {} as Record<string, unknown>,
    collectionOptions: {} as Record<string, unknown>,
    panels: {} as Record<string, { open: boolean; variant?: string; display?: string }>,
}))

vi.mock("next/navigation", () => ({
    usePathname: () => "/finances/budgets/list",
    useRouter: () => ({ replace: m.replace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(m.navQuery),
}))
vi.mock("@/components/providers", () => ({
    useGlobalModals: () => ({ openEntity: m.openEntity }),
    EntityPanelTab: ({ children, label, variant, display, open }: {
        children: (open: boolean) => ReactNode
        label: string
        variant?: string
        display?: string
        open: boolean
    }) => {
        m.panels[`${label}:${variant ?? "default"}`] = { open, variant, display }
        return <>{children(open)}</>
    },
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useOptionalGlobalModalActions: () => undefined,
}))
vi.mock("@/hooks/useDeepLinkEntity", () => ({ useDeepLinkEntity: m.deepLink }))
vi.mock("@/hooks/useSelectedEntity", () => ({
    useSelectedEntity: () => ({ entity: m.selectedEntity, isLoading: false, clearSelection: vi.fn(), clearSelectionNow: vi.fn() }),
}))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ serverDate: null }) }))
vi.mock("../../entity-view/budget.entity", () => ({
    budgetEntity: {},
    budgetViews: { table: {}, card: {} },
}))
vi.mock("@/features/finance/budgetActions", () => ({
    budgetActions: {
        forCollection: (ctx: { onEdit: (id: number) => void; onViewExecution: (id: number) => void }) =>
            (item: Budget) => (
                <>
                    <button onClick={() => ctx.onEdit(item.id)}>Editar Montos</button>
                    <button onClick={() => ctx.onViewExecution(item.id)}>Ver Ejecución</button>
                </>
            ),
    },
}))
vi.mock("../BudgetExecutionPanel", () => ({
    BudgetExecutionPanel: ({ budget, open }: { budget: Budget | null; open: boolean }) =>
        open ? <div data-testid="execution-panel">Ejecución: {budget?.name}</div> : null,
}))
vi.mock("@/features/finance/api/financeApi", () => ({
    financeApi: {
        getBudgets: m.getBudgets,
        getBudgetDetail: m.getBudgetDetail,
        getBudgetExecution: m.getBudgetExecution,
    },
}))
vi.mock("@/components/entity-view", async (importOriginal) => {
    // Parcial: el provider registra tipos de celda y otras entidades al importarse.
    const actual = await importOriginal<typeof import("@/components/entity-view")>()
    const Root = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
        m.collectionProps = props
        return <div>{children}</div>
    }
    const Toolbar = () => (
        <div role="toolbar">
            <button onClick={() => { m.query.search.applyFilter("search", "Presupuesto") }}>Buscar por nombre</button>
            <button onClick={() => {
                m.query.search.applyFilter("start_date__gte", "2026-01-01")
                m.query.search.applyFilter("end_date__lte", "2026-12-31")
            }}>Filtrar por periodo</button>
        </div>
    )
    const View = ({ onResetFilters }: { onResetFilters?: () => void }) => (
        <div>
            {m.rows.map((budget) => (
                <div key={budget.id}>
                    <button onClick={() => (m.collectionProps.onOpen as (b: Budget) => void)(budget)}>{budget.name}</button>
                    {typeof m.collectionProps.actions === "function" &&
                        (m.collectionProps.actions as (b: Budget, surface: string) => ReactNode)(budget, "table")}
                </div>
            ))}
            {m.rows.length === 0 && (
                <div>
                    <p>Aún no hay presupuestos</p>
                    {m.collectionOptions.isFiltered === true && <button onClick={onResetFilters}>Limpiar filtros</button>}
                </div>
            )}
        </div>
    )
    return {
        ...actual,
        Collection: Object.assign(Root, { Root, Toolbar, View }),
        useCollectionQuery: () => m.query,
        useCollectionViewMode: () => ({ view: "table", onViewChange: vi.fn() }),
        useEntityCollection: (_entity: unknown, options: Record<string, unknown>) => {
            m.collectionOptions = options
            return {}
        },
        useServerPage: () => [{ pageIndex: 0, pageSize: 50 }, vi.fn()],
    }
})

function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <BudgetsClientView />
        </QueryClientProvider>,
    )
}

const budget604: Budget = {
    id: 604,
    name: "Presupuesto 2026",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
}

beforeEach(() => {
    m.rows = [budget604]
    m.count = m.rows.length
    m.navQuery = ""
    m.selectedEntity = null
    m.collectionProps = {}
    m.collectionOptions = {}
    m.panels = {}
    m.query.params = {}
    m.query.search.isFiltered = false
    m.openEntity.mockReset()
    m.replace.mockReset()
    m.deepLink.mockReset()
    m.query.search.applyFilter.mockReset()
    m.query.search.clearAll.mockReset().mockImplementation(() => { m.query.params = {} })
    m.getBudgets.mockReset().mockImplementation(async () => ({
        count: m.count, next: null, previous: null, results: m.rows,
    }))
    m.getBudgetDetail.mockReset().mockResolvedValue(budget604)
    m.getBudgetExecution.mockReset().mockResolvedValue({
        summary: { total_budgeted: 1, total_actual: 1, total_variance: 0 }, items: [],
    })
})

describe("BudgetsClientView (ADR-0158/0152)", () => {
    it("la barra recibe la query y búsqueda + rango de fechas llegan al hook de lista", async () => {
        m.query.params = {
            search: "Presupuesto",
            start_date__gte: "2026-01-01",
            end_date__lte: "2026-12-31",
        }
        renderView()

        expect(m.collectionProps.query).toBe(m.query)
        await waitFor(() => expect(m.getBudgets).toHaveBeenCalledWith({
            search: "Presupuesto",
            start_date__gte: "2026-01-01",
            end_date__lte: "2026-12-31",
            page: "1",
            page_size: "50",
        }))

        await userEvent.click(screen.getByRole("button", { name: "Buscar por nombre" }))
        expect(m.query.search.applyFilter).toHaveBeenCalledWith("search", "Presupuesto")
        await userEvent.click(screen.getByRole("button", { name: "Filtrar por periodo" }))
        expect(m.query.search.applyFilter).toHaveBeenCalledWith("start_date__gte", "2026-01-01")
        expect(m.query.search.applyFilter).toHaveBeenCalledWith("end_date__lte", "2026-12-31")
    })

    it("el estado vacío ofrece «Limpiar filtros» y invoca clearAll, que restaura los params", async () => {
        m.rows = []
        m.count = 0
        m.query.search.isFiltered = true
        m.query.params = { search: "Inexistente" }
        renderView()

        expect(await screen.findByText("Aún no hay presupuestos")).toBeInTheDocument()
        expect(m.collectionOptions.isFiltered).toBe(true)
        await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))
        expect(m.query.search.clearAll).toHaveBeenCalledOnce()
        expect(m.query.params).toEqual({})
    })

    it("el clic en una fila abre la ficha de accounting.budget", async () => {
        renderView()
        await userEvent.click(await screen.findByRole("button", { name: "Presupuesto 2026" }))
        expect(m.openEntity).toHaveBeenCalledWith("accounting.budget", 604)
    })

    it("«Ver Ejecución» escribe selected + action sin abrir el editor", async () => {
        renderView()
        await userEvent.click(await screen.findByRole("button", { name: "Ver Ejecución" }))
        expect(m.replace).toHaveBeenCalledWith(
            "/finances/budgets/list?selected=604&action=execution",
            { scroll: false },
        )
        expect(m.openEntity).not.toHaveBeenCalled()
        expect(m.panels["accounting.budget:default"]?.open).toBe(false)
    })

    it("el deep link con action=execution abre solo la pestaña de ejecución", () => {
        m.navQuery = "selected=604&action=execution"
        m.selectedEntity = budget604
        renderView()

        expect(m.deepLink).toHaveBeenCalledWith("accounting.budget", { actions: [null] })
        expect(m.panels["accounting.budget:execution"]).toMatchObject({
            open: true,
            variant: "execution",
            display: "Ejecución: Presupuesto 2026",
        })
        expect(screen.getByTestId("execution-panel")).toHaveTextContent("Presupuesto 2026")
        expect(m.panels["accounting.budget:default"]?.open).toBe(false)
    })
})

describe("useBudgetDetailData", () => {
    it("con initialBudget solo pide la ejecución, no el detalle del presupuesto", async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                {children}
            </QueryClientProvider>
        )
        const { result } = renderHook(() => useBudgetDetailData(604, budget604), { wrapper })

        await waitFor(() => expect(result.current.data).toMatchObject({ budget: budget604 }))
        expect(m.getBudgetExecution).toHaveBeenCalledWith(604)
        expect(m.getBudgetDetail).not.toHaveBeenCalled()
    })

    it("sin initialBudget pide detalle y ejecución en paralelo", async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                {children}
            </QueryClientProvider>
        )
        const { result } = renderHook(() => useBudgetDetailData(604), { wrapper })

        await waitFor(() => expect(result.current.data).toMatchObject({ budget: budget604 }))
        expect(m.getBudgetDetail).toHaveBeenCalledWith(604)
        expect(m.getBudgetExecution).toHaveBeenCalledWith(604)
    })
})
