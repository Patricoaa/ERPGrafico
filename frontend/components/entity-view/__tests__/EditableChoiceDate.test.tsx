import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import {
    EditableCollection,
    defineEditable,
    defineEntity,
    editableErrorsFromForm,
    editableSchema,
    initialEditableValues,
    toEditableErrors,
    type EditableChoice,
    type EditableRowValue,
} from "@/components/entity-view"

vi.mock("@/hooks/usePeriodValidation", () => ({
    usePeriodValidation: () => ({
        validatePeriod: vi.fn(),
        validatePeriodImmediate: vi.fn(),
        clearPeriodValidation: vi.fn(),
        isValidating: false,
        isClosed: false,
        message: null,
    }),
}))

interface Line {
    id: number
    name: string
    pending: number
    uomId: number
    units: EditableChoice[]
}

const entity = defineEntity<Line>()((f) => ({
    title: "Prueba",
    fields: { name: f.text("name", { label: "Producto" }) },
}))

const def = defineEditable(entity, {
    rowKey: (l) => l.id,
    context: ["name"],
    inputs: {
        qty: { kind: "quantity", header: "A recibir", label: (l) => `Cantidad — ${l.name}`, max: (l) => l.pending },
        uom: { kind: "choice", header: "Unidad", label: (l) => `Unidad — ${l.name}`, options: (l) => l.units, initialText: (l) => String(l.uomId), required: true },
        start: { kind: "date", header: "Inicio", label: (l) => `Inicio — ${l.name}`, required: true },
    },
})

const UN = { value: "1", label: "Unidad" }
const BOX = { value: "2", label: "Caja x12" }
const ROWS: Line[] = [
    { id: 1, name: "Papel", pending: 5, uomId: 1, units: [UN, BOX] },
    { id: 2, name: "Tinta", pending: 2, uomId: 1, units: [UN] },
]

const valueOf = (patch: Partial<Record<number, Partial<EditableRowValue>>> = {}): EditableRowValue[] =>
    initialEditableValues(def, ROWS).map((v, i) => ({
        ...v,
        values: { qty: 1 },
        textValues: { ...v.textValues, start: "2026-11-26" },
        ...patch[i],
    }))

describe("EditableCollection · choice and date inputs (ADR-0087 amendment)", () => {
    it("starts choice and date cells as strings, outside the numeric values", () => {
        const [first] = initialEditableValues(def, ROWS)
        expect(first.values).toEqual({ qty: 0 })
        expect(first.textValues).toEqual({ uom: "1", start: "" })
    })

    it("validates presence, membership and the date format under textValues", () => {
        const value = valueOf({
            0: { textValues: { uom: "9", start: "26/11/2026" } },
            1: { textValues: { uom: "", start: "" } },
        })
        const parsed = editableSchema(def, ROWS).safeParse(value)
        expect(parsed.success).toBe(false)
        if (parsed.success) return
        expect(parsed.error.issues.every((i) => i.path.length === 0 || i.path[1] !== "values" || i.path[2] === "qty")).toBe(true)
        expect(toEditableErrors(parsed.error, value)).toEqual({
            "1": { uom: "Opción no válida", start: "Fecha no válida" },
            "2": { uom: "Elige una opción", start: "Ingresa una fecha" },
        })
    })

    it("maps react-hook-form errors of string cells (textValues) too", () => {
        const value = valueOf()
        const rhf = { 1: { textValues: { start: { message: "Ingresa una fecha" } }, values: { qty: { message: "Máx. 2" } } } }
        expect(editableErrorsFromForm(rhf, value)).toEqual({ "2": { start: "Ingresa una fecha", qty: "Máx. 2" } })
    })

    it("accepts valid choices and dates, and counts only numeric inputs toward 'at least one'", () => {
        expect(editableSchema(def, ROWS).safeParse(valueOf()).success).toBe(true)
        const none = valueOf({ 0: { values: { qty: 0 } }, 1: { values: { qty: 0 } } })
        expect(editableSchema(def, ROWS).safeParse(none).success).toBe(false)
    })

    it("renders a select when there is a choice and plain text when there is one option", () => {
        render(<EditableCollection definition={def} rows={ROWS} value={valueOf({ 0: { textValues: { uom: "2", start: "2026-11-26" } } })} onChange={() => {}} label="Recepción" />)
        expect(screen.getByRole("combobox", { name: "Unidad — Papel" })).toHaveTextContent("Caja x12")
        expect(screen.queryByRole("combobox", { name: "Unidad — Tinta" })).toBeNull()
        expect(screen.getByLabelText("Unidad — Tinta")).toHaveTextContent("Unidad")
        expect(screen.getByLabelText("Inicio — Papel")).toBeInTheDocument()
        expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Producto", "A recibir", "Unidad", "Inicio"])
    })
})
