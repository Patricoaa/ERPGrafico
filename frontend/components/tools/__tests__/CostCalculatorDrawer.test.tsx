import { Button } from "@/components/ui/button"
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CostCalculatorDrawer } from "@/components/tools/CostCalculatorDrawer"
import { GlobalModalProvider } from "@/components/providers/GlobalModalProvider"

const PRODUCT = {
    id: 1, name: "Papel couché", internal_code: "PC-1", cost_price: 1000, product_type: "STORABLE",
    track_inventory: true, uom: 3, uom_name: "Unidad", available_uoms: [{ id: 3, name: "Unidad", ratio: 1 }],
}

vi.mock("next/navigation", () => ({ usePathname: () => "/inventory/products", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => ({ rate: 19, multiplier: 1.19 }) }))
vi.mock("@/features/inventory/hooks/useProducts", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useProducts: () => ({ products: [PRODUCT], isLoading: false }),
}))
vi.mock("@/features/inventory/hooks/useCategories", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useCategories: () => ({ categories: [], isLoading: false }),
}))
vi.mock("@/components/selectors", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ProductGridPicker: ({ onProductClick }: { onProductClick: (p: unknown) => void }) => (
        <Button type="button" onClick={() => onProductClick(PRODUCT)}>agregar-papel</Button>
    ),
}))

function renderCalculator(open: boolean) {
    return <GlobalModalProvider><CostCalculatorDrawer open={open} onOpenChange={() => {}} /></GlobalModalProvider>
}

describe("CostCalculatorDrawer", () => {
    it("se abre como panel derecho de 900 px con su título", async () => {
        render(renderCalculator(true))
        const panel = await screen.findByRole("dialog", { name: /calculadora de costos/i })
        expect(panel).toHaveAttribute("data-side", "right")
        expect(panel).toHaveClass("w-[900px]")
    })

    it("conserva los productos elegidos al cerrar y volver a abrir", async () => {
        const user = userEvent.setup()
        const { rerender } = render(renderCalculator(true))
        await user.click(await screen.findByRole("button", { name: "agregar-papel" }))
        expect(screen.getByText("Papel couché")).toBeInTheDocument()
        rerender(renderCalculator(false))
        await waitFor(() => expect(screen.queryByText("Papel couché")).not.toBeInTheDocument())
        rerender(renderCalculator(true))
        expect(await screen.findByText("Papel couché")).toBeInTheDocument()
    })
})
