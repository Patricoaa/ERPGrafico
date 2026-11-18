import { beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ redirect }))

import AccountingRcvReconciliationPage from "../page"

describe("ruta anterior del cuadre", () => {
    beforeEach(() => redirect.mockReset())

    it("redirige al cuadre conservando la query (selected, filtros)", async () => {
        await AccountingRcvReconciliationPage({
            searchParams: Promise.resolve({ selected: "12", status: ["DIFF", "AMBIGUOUS"] }),
        })
        expect(redirect).toHaveBeenCalledWith("/accounting/rcv/cuadre?selected=12&status=DIFF&status=AMBIGUOUS")
    })

    it("sin query redirige a la ruta limpia", async () => {
        await AccountingRcvReconciliationPage({ searchParams: Promise.resolve({}) })
        expect(redirect).toHaveBeenCalledWith("/accounting/rcv/cuadre")
    })
})
