import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { ENTITY_DRAWERS } from "../entity-drawers"

const m = vi.hoisted(() => ({ record: null as unknown, isError: false, calls: [] as Array<[string, unknown]> }))

vi.mock("next/dynamic", () => ({
    // Cada drawer perezoso se sustituye por un stub que expone las props que importan.
    default: () => function DrawerStub(props: Record<string, unknown>) {
        const record = props.employee ?? props.initialData ?? props.absence ?? props.movement ?? props.provider ?? props.device ?? props.bank ?? props.method
        return <div data-testid="drawer">{JSON.stringify({ record, mode: props.mode ?? null })}</div>
    },
}))
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock("@/hooks/useRecordById", () => ({
    useRecordById: (endpoint: string, id: number | null) => {
        m.calls.push([endpoint, id])
        return { record: m.record, isLoading: !m.record && !m.isError, isError: m.isError }
    },
}))
vi.mock("@/components/shared", () => ({ SkeletonShell: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} /> }))

const drawer = (label: string, props: { id: number; data?: unknown }) =>
    ENTITY_DRAWERS[label]({ id: props.id, data: props.data, open: true, onOpenChange: vi.fn() })

describe("ENTITY_DRAWERS por registro (ADR-0152)", () => {
    beforeEach(() => { m.record = null; m.isError = false; m.calls = [] })

    it.each([
        ["hr.employee", "/hr/employees"],
        ["hr.absence", "/hr/absences"],
        ["hr.employeemovement", "/hr/employee-movements"],
        ["core.user", "/core/users"],
        ["inventory.category", "/inventory/categories"],
        ["inventory.warehouse", "/inventory/warehouses"],
        ["inventory.uom", "/inventory/uoms"],
        ["inventory.attribute", "/inventory/attributes"],
        ["inventory.pricingrule", "/inventory/pricing-rules"],
        ["inventory.uomcategory", "/inventory/uom-categories"],
        ["treasury.terminalprovider", "/treasury/terminal-providers"],
        ["treasury.terminaldevice", "/treasury/terminal-devices"],
        ["treasury.bank", "/treasury/banks"],
        ["treasury.paymentmethod", "/treasury/payment-methods"],
    ])("%s: con la fila no consulta y abre en edición", (label, _endpoint) => {
        render(<>{drawer(label, { id: 3, data: { id: 3, name: "x" } })}</>)
        expect(m.calls).toEqual([[_endpoint, null]])
        expect(screen.getByTestId("drawer").textContent).toBe(JSON.stringify({ record: { id: 3, name: "x" }, mode: null }))
    })

    it("solo con id carga el registro por su endpoint y muestra el esqueleto mientras tanto", () => {
        const { rerender } = render(<>{drawer("hr.employee", { id: 8 })}</>)
        expect(m.calls[0]).toEqual(["/hr/employees", 8])
        expect(screen.queryByTestId("drawer")).toBeNull()
        expect(screen.getByLabelText("Cargando empleado")).toBeInTheDocument()

        m.record = { id: 8, name: "Eva" }
        rerender(<>{drawer("hr.employee", { id: 8 })}</>)
        expect(screen.getByTestId("drawer").textContent).toContain("Eva")
    })

    it("si la carga falla no monta el formulario (nunca cae en creación)", () => {
        m.isError = true
        const { container } = render(<>{drawer("inventory.warehouse", { id: 5 })}</>)
        expect(container).toBeEmptyDOMElement()
    })
})
