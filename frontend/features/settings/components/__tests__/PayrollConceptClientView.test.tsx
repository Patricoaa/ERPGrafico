import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render as rtlRender, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { PayrollConcept } from "@/types/hr"

const state = vi.hoisted(() => ({ deleteConcept: vi.fn(), concepts: [] as unknown[] }))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/hr/settings/concepts",
    useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: () => true, user: { id: 1 } }) }))
vi.mock("@/features/hr", () => ({
    useHrSettings: () => ({ concepts: state.concepts, isLoading: false, refetch: vi.fn(), deleteConcept: state.deleteConcept }),
    FormulaBuilder: () => null,
}))
vi.mock("../PayrollConceptDrawer", () => ({
    PayrollConceptDrawer: ({ open, concept }: { open: boolean; concept: PayrollConcept | null }) =>
        open ? <div role="dialog">{concept ? `editando ${concept.name}` : "nuevo concepto"}</div> : null,
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ open, children }: { open: boolean; children: (open: boolean) => React.ReactNode }) => (open ? <>{children(open)}</> : null),
}))

import { PayrollConceptClientView } from "../PayrollConceptClientView"

const concept = (over: Partial<PayrollConcept>): PayrollConcept => ({
    id: 1, name: "Sueldo base", category: "HABER_IMPONIBLE", category_display: "Haber Imponible", formula_type: "FIXED",
    formula_type_display: "Monto Fijo", account: 10, account_code: "5.1.01", is_system: false, default_amount: "0", formula: "",
    ...over,
}) as unknown as PayrollConcept

const render = (ui: React.ReactElement) => rtlRender(<QueryClientProvider client={new QueryClient()}><NuqsTestingAdapter>{ui}</NuqsTestingAdapter></QueryClientProvider>)

describe("PayrollConceptClientView", () => {
    beforeEach(() => {
        state.deleteConcept.mockReset()
        state.concepts = [concept({}), concept({ id: 2, name: "AFP Capital", category: "DESCUENTO_LEGAL_TRABAJADOR", category_display: "Descuento Legal", is_system: true })]
    })

    it("lista los conceptos y el botón crear abre el drawer en modo creación", () => {
        render(<PayrollConceptClientView />)
        expect(screen.getByText("Sueldo base")).toBeInTheDocument()
        expect(screen.getByText("AFP Capital")).toBeInTheDocument()
        fireEvent.click(screen.getAllByRole("button", { name: /Nuevo Concepto/i })[0])
        expect(screen.getByRole("dialog")).toHaveTextContent("nuevo concepto")
    })
})
