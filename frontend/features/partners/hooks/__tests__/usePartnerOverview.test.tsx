import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PartnerOverview } from "@/features/contacts"
import { PARTNER_KEYS } from "../queryKeys"
import { usePartnerOverview } from "../usePartnerOverview"

const getOverview = vi.fn()

vi.mock("@/features/contacts/api/partnersApi", () => ({
    partnersApi: { getOverview: (...a: unknown[]): unknown => getOverview(...a) },
}))

const overview: PartnerOverview = {
    alerts: [{ code: "pending_capital", severity: "warning", amount: "100.00", target_tab: "capital", action: "contribution" }],
    kpis: { equity_percentage: "50", total_contributions: "1000", total_paid_in: "900", pending_capital: "100", excess_capital: "0", net_equity: "900" },
    info: { partner_since: "2024-01-01", tax_id: "123", contact_id: 7 },
    composition: { capital: "900", earnings_balance: "0", dividends_payable: "0", provisional_withdrawals: "0" },
}

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return Wrapper
}

beforeEach(() => vi.clearAllMocks())

describe("usePartnerOverview", () => {
    it("no consulta con id nulo", () => {
        const { result } = renderHook(() => usePartnerOverview(null), { wrapper: wrapper() })
        expect(result.current.fetchStatus).toBe("idle")
        expect(getOverview).not.toHaveBeenCalled()
    })

    it("con id consulta el overview del socio", async () => {
        getOverview.mockResolvedValue(overview)
        const { result } = renderHook(() => usePartnerOverview(7), { wrapper: wrapper() })
        await waitFor(() => expect(result.current.data).toEqual(overview))
        expect(getOverview).toHaveBeenCalledWith(7)
    })

    it("la clave cuelga de la raíz de socios", () => {
        expect(PARTNER_KEYS.overview(7).slice(0, 1)).toEqual(PARTNER_KEYS.all)
    })
})
