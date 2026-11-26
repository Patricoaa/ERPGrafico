import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { Account } from "@/features/accounting"
import { MappingConfigModal } from "../MappingConfigModal"

// Radix Select in jsdom.
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

const accounts = [
    { id: 1, code: "4.1.01", name: "Ventas de impresión", account_type_display: "Ingreso", is_category: null },
    { id: 2, code: "5.1.01", name: "Papel y tintas", account_type_display: "Gasto", is_category: "COST_OF_SALES" },
] as unknown as Account[]

vi.mock("@/features/finance/hooks/useAccountMappings", () => ({
    useAccountMappings: () => ({ accounts, isLoading: false, fieldName: "is_category", saveAll: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: () => undefined }))

function renderModal() {
    return render(
        <NuqsTestingAdapter>
            <MappingConfigModal open onOpenChange={vi.fn()} mappingType="is" />
        </NuqsTestingAdapter>,
    )
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement

describe("MappingConfigModal (entity-view, ADR-0159)", () => {
    it("lists the accounts with their saved category", () => {
        renderModal()
        expect(rowOf("Ventas de impresión")).toHaveTextContent("Sin mapeo")
        expect(rowOf("Papel y tintas")).toHaveTextContent("Costo de Ventas")
    })

    it("assigns a category to the selected rows from the selection dock", async () => {
        const user = userEvent.setup()
        renderModal()
        await user.click(within(rowOf("Ventas de impresión")).getByRole("checkbox"))
        await user.click(screen.getByRole("combobox", { name: "Asignar categoría" }))
        await user.click(await screen.findByRole("option", { name: "Ingresos Operacionales" }))
        expect(rowOf("Ventas de impresión")).toHaveTextContent("Ingresos Operacionales")
        expect(within(rowOf("Ventas de impresión")).getByRole("checkbox")).not.toBeChecked()
    })
})
