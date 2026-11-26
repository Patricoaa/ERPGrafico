import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FINANCE_KEYS } from "../queryKeys"
import { useBudgetVarianceExport } from "../useBudgetVarianceExport"
import type { BudgetVarianceNode } from "../../types"

const m = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    blob: null as Blob | null,
    createObjectURL: vi.fn((blob: Blob) => {
        m.blob = blob
        return "blob:variacion"
    }),
}))

vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }))

const node: BudgetVarianceNode = {
    id: 1, code: "4", name: "Ingresos", type: "INCOME",
    month_actual: 100, month_budget: 80, month_variance: 20, month_percentage: 25,
    ytd_actual: 900, ytd_budget: 800, ytd_variance: 100, ytd_percentage: 12.5,
    is_unbudgeted: false, children: [],
}

describe("useBudgetVarianceExport", () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient()
        Object.defineProperty(URL, "createObjectURL", { value: m.createObjectURL, configurable: true })
        Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true })
    })

    it("descarga un CSV con la variación del periodo solicitado", () => {
        queryClient.setQueryData(FINANCE_KEYS.budgets.variance(604, { month: "3", year: "2025" }), [node])
        let downloaded = ""
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            downloaded = this.download
        })

        const { result } = renderHook(() => useBudgetVarianceExport(), { wrapper })
        act(() => result.current.run("csv", { budget: 604, month: "3", year: "2025" }))

        expect(m.createObjectURL).toHaveBeenCalledTimes(1)
        expect(m.blob?.type).toContain("text/csv")
        expect(downloaded).toBe("variacion_604_2025-3.csv")
        expect(m.success).toHaveBeenCalled()
        click.mockRestore()
    })

    it("no descarga nada cuando el periodo no tiene datos", () => {
        const { result } = renderHook(() => useBudgetVarianceExport(), { wrapper })
        act(() => result.current.run("csv", { budget: 604, month: "3", year: "2025" }))

        expect(m.createObjectURL).not.toHaveBeenCalled()
        expect(m.error).toHaveBeenCalled()
    })
})
