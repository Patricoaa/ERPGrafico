import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BudgetExecutionPanel } from "../BudgetExecutionPanel"
import type { Budget } from "../../hooks/useBudgets"

const m = vi.hoisted(() => ({
    exportCsv: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
}))

const budget604: Budget = {
    id: 604,
    name: "Presupuesto 2026",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
}

vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }))

vi.mock("../../api/financeApi", () => ({
    financeApi: { exportBudgetCsv: m.exportCsv },
}))

vi.mock("../../hooks/useBudgets", () => ({
    useBudgetDetailData: () => ({
        data: {
            budget: budget604,
            execution: {
                summary: { total_budgeted: 100, total_actual: 80, total_variance: -20 },
                items: [],
            },
        },
        isLoading: false,
        isError: false,
    }),
}))

vi.mock("../../entity-view/budgetExecution.entity", () => ({
    budgetExecutionEntity: {},
    budgetExecutionViews: { table: {} },
}))

vi.mock("@/components/shared", () => ({
    BaseModal: ({ open, title, description, footer, children }: {
        open: boolean
        title: string
        description: string
        footer: ReactNode
        children: ReactNode
    }) => open ? (
        <div role="dialog">
            <h2>{title}</h2>
            <p>{description}</p>
            {children}
            {footer}
        </div>
    ) : null,
    Metric: ({ label, value }: { label: string; value: string }) => <div>{label}: {value}</div>,
    MetricStrip: ({ label, children }: { label: string; children: ReactNode }) => (
        <section aria-label={label}>{children}</section>
    ),
    SkeletonShell: ({ isLoading, children }: { isLoading: boolean; children: ReactNode }) => (
        <div>{isLoading ? "Cargando" : children}</div>
    ),
    StaleDataBanner: () => <div>Datos desactualizados</div>,
}))

vi.mock("@/components/entity-view", () => ({
    useEntityCollection: () => ({}),
    Collection: {
        Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        View: () => <div>Sin cuentas presupuestarias</div>,
    },
}))

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
        <button {...props}>{children}</button>
    ),
}))

function renderPanel() {
    return render(<BudgetExecutionPanel budget={budget604} open onOpenChange={vi.fn()} />)
}

beforeEach(() => {
    m.exportCsv.mockReset().mockResolvedValue(new Blob(["cuenta,importe\n1,100\n"]))
    m.success.mockReset()
    m.error.mockReset()
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:ejecucion"),
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("BudgetExecutionPanel (ADR-0152 / ADR-0158)", () => {
    it("descarga el CSV del presupuesto abierto y avisa al usuario", async () => {
        renderPanel()
        const createElement = vi.spyOn(document, "createElement")
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        await userEvent.click(screen.getByRole("button", { name: /Exportar CSV/i }))

        await waitFor(() => expect(m.exportCsv).toHaveBeenCalledWith(604))
        const anchor = createElement.mock.results
            .map((result) => result.value as unknown)
            .find((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement)
        expect(anchor?.getAttribute("download")).toBe("ejecucion_Presupuesto 2026.csv")
        expect(click).toHaveBeenCalled()
        expect(m.success).toHaveBeenCalledWith("Exportación iniciada")
    })

    it("avisa del error si falla la exportación", async () => {
        m.exportCsv.mockRejectedValueOnce(new Error("boom"))
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
        renderPanel()

        await userEvent.click(screen.getByRole("button", { name: /Exportar CSV/i }))

        await waitFor(() => expect(m.error).toHaveBeenCalledWith("Error al exportar CSV"))
        expect(consoleError).toHaveBeenCalled()
    })
})
