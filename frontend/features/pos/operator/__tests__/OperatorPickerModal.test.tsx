import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { OperatorPickerModal } from "../OperatorPickerModal"
import type { PosOperator } from "../../types"

const ana: PosOperator = { id: 1, username: "ana", full_name: "Ana Pérez", initials: "AP" }
const beto: PosOperator = { id: 2, username: "beto", full_name: "Beto Soto", initials: "BS" }

function setup(overrides: Partial<React.ComponentProps<typeof OperatorPickerModal>> = {}) {
    const props = {
        open: true,
        operators: [ana, beto],
        isLoading: false,
        isError: false,
        onRetry: vi.fn(),
        onSelect: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    }
    render(<OperatorPickerModal {...props} />)
    return props
}

describe("OperatorPickerModal", () => {
    it("lista los operadores y devuelve el elegido", () => {
        const props = setup()
        expect(screen.getByText("¿Quién opera?")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: /Beto Soto/ }))
        expect(props.onSelect).toHaveBeenCalledWith(beto)
    })

    it("cancelar avisa", () => {
        const props = setup()
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
        expect(props.onCancel).toHaveBeenCalled()
    })

    it("muestra el estado de carga", () => {
        setup({ isLoading: true, operators: [] })
        expect(screen.getByRole("status", { name: "Cargando operadores" })).toBeTruthy()
        expect(screen.queryByRole("button", { name: /Ana/ })).toBeNull()
    })

    it("muestra el estado vacío", () => {
        setup({ operators: [] })
        expect(screen.getByText("No hay operadores habilitados para esta caja.")).toBeTruthy()
    })

    it("muestra el error con reintento", () => {
        const props = setup({ isError: true, operators: [] })
        expect(screen.getByText("No se pudieron cargar los operadores.")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(props.onRetry).toHaveBeenCalled()
    })

    it("ofrece buscador solo con más de 12 operadores y filtra", () => {
        setup()
        expect(screen.queryByPlaceholderText("Buscar operador…")).toBeNull()
        const many: PosOperator[] = Array.from({ length: 13 }, (_, i) => ({
            id: 100 + i, username: `p${i}`, full_name: i === 7 ? "Zoila Rara" : `Persona ${i}`, initials: "PX",
        }))
        setup({ operators: many })
        const search = screen.getByPlaceholderText("Buscar operador…")
        fireEvent.change(search, { target: { value: "zoila" } })
        expect(screen.getByRole("button", { name: /Zoila Rara/ })).toBeTruthy()
        expect(screen.queryByRole("button", { name: /Persona 1$/ })).toBeNull()
    })

    it("no deja elegir mientras se identifica", () => {
        const props = setup({ isSubmitting: true })
        fireEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }))
        expect(props.onSelect).not.toHaveBeenCalled()
    })
})
