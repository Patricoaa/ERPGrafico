import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmployeeMovement } from "@/types/hr"
import { EmployeeMovementsHistory } from "../EmployeeMovementsHistory"

const m = vi.hoisted(() => ({ state: { movements: [] as unknown[], isLoading: false, isError: false } }))

vi.mock("../../hooks/useEmployeeMovementHistory", () => ({
    useEmployeeMovementHistory: () => ({ ...m.state, refetch: vi.fn() }),
}))
vi.mock("./EmployeeMovementDrawer", () => ({ EmployeeMovementDrawer: () => null }))
vi.mock("../NewEmployeeMovementFlow", () => ({
    NewEmployeeMovementFlow: ({ open, initialKind }: { open: boolean; initialKind: string }) => (open ? <div data-testid="flow">{initialKind}</div> : null),
}))

const base = { notes: "", journal_entry: null, rate: null, rate_period: null, installments_count: null, first_installment_year: null, first_installment_month: null, allocations: [] }
const advance = { ...base, id: 1, display_id: "MOV-1", kind: "ADVANCE", kind_display: "Anticipo", date: "2026-09-01", amount: "100000", balance: 40000, status: "POSTED", status_display: "Vigente", installments: [] }
const payment = { ...base, id: 2, display_id: "MOV-2", kind: "PAYMENT", kind_display: "Pago de remuneración", date: "2026-09-30", amount: "450000", balance: 0, status: "POSTED", status_display: "Vigente", installments: [] }
const loan = {
    ...base, id: 3, display_id: "MOV-3", kind: "LOAN", kind_display: "Préstamo", date: "2026-10-05", amount: "600000", balance: 500000, status: "POSTED", status_display: "Vigente",
    installments: [
        { id: 1, number: 1, year: 2026, month: 11, principal: 97529, interest: 6000, amount: 103529, status: "APPLIED" },
        { id: 2, number: 2, year: 2026, month: 12, principal: 98504, interest: 5025, amount: 103529, status: "PENDING" },
    ],
}

beforeEach(() => { m.state = { movements: [loan, payment, advance], isLoading: false, isError: false } })

describe("EmployeeMovementsHistory", () => {
    it("lists the three kinds with their balance and status", () => {
        render(<EmployeeMovementsHistory employeeId={5} onOpen={vi.fn()} />)
        const rows = screen.getAllByRole("row").slice(1)
        expect(rows).toHaveLength(3)
        expect(within(rows[0]).getByText("Préstamo")).toBeInTheDocument()
        expect(within(rows[1]).getByText("Pago de remuneración")).toBeInTheDocument()
        expect(within(rows[2]).getByText("Anticipo")).toBeInTheDocument()
        expect(within(rows[2]).getByText(/40\.000/)).toBeInTheDocument()
        expect(within(rows[2]).getByText("Vigente")).toBeInTheDocument()
    })

    it("expands a loan to its installments with applied/pending status", async () => {
        render(<EmployeeMovementsHistory employeeId={5} onOpen={vi.fn()} />)
        await userEvent.click(screen.getByRole("button", { name: /Ver cuotas/ }))
        expect(screen.getByText(/Cuotas de MOV-3/)).toBeInTheDocument()
        expect(screen.getByText("Descontada")).toBeInTheDocument()
        expect(screen.getByText("Pendiente")).toBeInTheDocument()
    })

    it("shows the empty state when there are no movements", () => {
        m.state = { movements: [], isLoading: false, isError: false }
        render(<EmployeeMovementsHistory employeeId={5} onOpen={vi.fn()} />)
        expect(screen.getAllByText(/Sin movimientos/).length).toBeGreaterThan(0)
    })

    it("shows an error message when the history fails", () => {
        m.state = { movements: [], isLoading: false, isError: true }
        render(<EmployeeMovementsHistory employeeId={5} onOpen={vi.fn()} />)
        expect(screen.queryAllByRole("row")).toHaveLength(0)
        expect(screen.getByText(/error|No se pudo|Reintentar/i)).toBeInTheDocument()
    })

    it("opens a movement and starts the new advance / loan flows", async () => {
        const onOpen = vi.fn()
        render(<EmployeeMovementsHistory employeeId={5} onOpen={onOpen} />)
        await userEvent.click(screen.getByText("MOV-1"))
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
        await userEvent.click(screen.getByRole("button", { name: /Nuevo préstamo/ }))
        expect(screen.getByTestId("flow")).toHaveTextContent("LOAN")
    })
})
