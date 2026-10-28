import { describe, expect, it } from "vitest"
import {
    EMPTY,
    defineEditable,
    defineEntity,
    editableSchema,
    formatDate,
    formatDateRange,
    formatMonth,
    formatFlow,
    formatMoneyValue,
    formatNumber,
    formatProgress,
    formatStatus,
    formatSum,
    getValueKind,
    initialEditableValues,
    resolveField,
    rowIdOf,
    sortValueOf,
    toEditableErrors,
} from "@/components/entity-view"

describe("formatters", () => {
    it("treats null, undefined and '' as missing, but keeps 0", () => {
        expect(formatNumber(null)).toBe(EMPTY)
        expect(formatNumber(undefined)).toBe(EMPTY)
        expect(formatNumber("")).toBe(EMPTY)
        expect(formatNumber(0)).toBe("0")
        expect(formatMoneyValue(0)).toMatch(/\$\s?0/)
    })

    it("formats decimals and suffixes with es-CL separators", () => {
        expect(formatNumber("1234.5", 2, "kg")).toBe("1.234,50 kg")
        expect(formatNumber("abc")).toBe(EMPTY)
    })

    it("formats money with currency and explicit sign policies", () => {
        expect(formatMoneyValue("1500")).toMatch(/1\.500/)
        expect(formatMoneyValue(-1500, "CLP", "never")).not.toContain("-")
        expect(formatMoneyValue(1500, "CLP", "always").startsWith("+")).toBe(true)
        expect(formatMoneyValue(10, "USD")).toMatch(/US\$|USD|\$/)
    })

    it("formats flows with direction sign, never by color alone (AX-7)", () => {
        expect(formatFlow(100, "inflow").startsWith("+")).toBe(true)
        expect(formatFlow(-100, "outflow").startsWith("−")).toBe(true)
        expect(formatFlow(null, "inflow")).toBe(EMPTY)
    })

    it("never shifts date-only values and rejects invalid dates", () => {
        expect(formatDate("2026-01-15")).toBe("15/01/2026")
        expect(formatDate(null)).toBe(EMPTY)
        expect(formatDate("")).toBe(EMPTY)
        expect(formatDate("not-a-date")).not.toBe("15/01/2026")
        expect(formatDateRange({ from: "2026-01-01", to: "2026-01-03" })).toBe("01/01/2026 – 03/01/2026")
        expect(formatDateRange({ from: "2026-01-01", to: null })).toBe("01/01/2026")
        // Month of a date-only value: the 1st must not slip to the previous month (UTC parse)
        expect(formatMonth("2026-10-01")).toBe("octubre de 2026")
        expect(formatMonth("2026-10-01T00:00:00Z")).toBe("octubre de 2026")
        expect(formatMonth(null)).toBe(EMPTY)
    })

    it("formats status labels and progress", () => {
        expect(formatStatus({ status: "PAID", label: "Cobrada" })).toBe("Cobrada")
        expect(formatStatus(null)).toBe(EMPTY)
        expect(formatProgress({ done: 3, total: 4 })).toBe("75 %")
        expect(formatProgress({ done: 3, total: 4 }, "ratio")).toBe("3/4")
        expect(formatProgress({ done: 1, total: 0 })).toBe(EMPTY)
    })
})

interface Line {
    id: number
    product_name: string
    unit_price: string
    unit_price_net: string
    quantity: number
    delivered: number
    blocked: boolean
}

const lineEntity = defineEntity<Line>()((f) => ({
    title: "Prueba",
    fields: {
        product: f.text("product_name", { label: "Producto" }),
        net: f.money("unit_price_net", { label: "Neto" }),
        quantity: f.quantity("quantity", { label: "Cantidad", uom: "u" }),
    },
}))

const rows: Line[] = [
    { id: 1, product_name: "Papel", unit_price: "100", unit_price_net: "900", quantity: 10, delivered: 4, blocked: false },
    { id: 2, product_name: "Tinta", unit_price: "500", unit_price_net: "50", quantity: 2, delivered: 0, blocked: true },
]

describe("field resolution", () => {
    it("resolves value, options and text with the kind formatter", () => {
        const r = resolveField(lineEntity.field("quantity"), rows[0])
        expect(r.value).toBe(10)
        expect(r.options).toEqual({ uom: "u" })
        expect(r.text).toBe("10 u")
    })

    it("sorts by the displayed (semantic) value, not by a raw key (fixes TC-007)", () => {
        const def = lineEntity.field("net")
        const keys = rows.map((row) => sortValueOf(def, row))
        expect(keys).toEqual([900, 50])
    })

    it("groups footer totals by unit instead of adding mixed units", () => {
        const mixed = defineEntity<{ id: number; qty: number; uom: string }>()((f) => ({
            title: "Prueba",
            fields: { qty: f.quantity("qty", { label: "Cantidad", uom: (r) => r.uom }) },
        }))
        const total = formatSum(mixed.field("qty"), [
            { id: 1, qty: 400, uom: "Hoja" },
            { id: 2, qty: 200, uom: "Hoja" },
            { id: 3, qty: 5, uom: "Millar" },
        ])
        expect(total).toBe("600 Hoja · 5 Millar")
    })

    it("throws on unregistered kinds at runtime too", () => {
        expect(() => getValueKind("nope" as "text")).toThrow(/no está registrado/)
    })

    it("extracts rowId from entity.rowId or falls back to row.id", () => {
        const defaultEntity = defineEntity<{ id: number; name: string }>()((f) => ({
            title: "Default",
            fields: { name: f.text("name", { label: "Nombre" }) },
        }))
        expect(rowIdOf(defaultEntity, { id: 42, name: "Test" })).toBe("42")

        const compoundEntity = defineEntity<{ id: number; type: string }>()((f) => ({
            title: "Compound",
            rowId: (r) => `${r.type}-${r.id}`,
            fields: { type: f.text("type", { label: "Tipo" }) },
        }))
        expect(rowIdOf(compoundEntity, { id: 42, type: "DELIVERY" })).toBe("DELIVERY-42")
    })
})

describe("editable surface schema (P1)", () => {
    const def = defineEditable(lineEntity, {
        rowKey: (l) => l.id,
        context: ["product", "quantity"],
        inputs: {
            take: {
                kind: "quantity",
                header: "A despachar",
                label: (l) => `Cantidad a despachar — ${l.product_name}`,
                max: (l) => l.quantity - l.delivered,
                initial: (l) => l.quantity - l.delivered,
            },
        },
        eligible: (l) => (l.blocked ? { ok: false, reason: "Requiere producción" } : { ok: true }),
    })

    it("prefills with the cap and zero for ineligible rows", () => {
        expect(initialEditableValues(def, rows)).toEqual([
            { key: "1", values: { take: 6 } },
            { key: "2", values: { take: 0 } },
        ])
    })

    it("accepts values within the cap", () => {
        expect(editableSchema(def, rows).safeParse(initialEditableValues(def, rows)).success).toBe(true)
    })

    it("rejects values over the cap with a per-cell error", () => {
        const value = [{ key: "1", values: { take: 7 } }, { key: "2", values: { take: 0 } }]
        const result = editableSchema(def, rows).safeParse(value)
        expect(result.success).toBe(false)
        if (!result.success) expect(toEditableErrors(result.error, value)).toEqual({ "1": { take: "Máx. 6,00" } })
    })

    it("rejects quantities on ineligible rows with the eligibility reason", () => {
        const value = [{ key: "1", values: { take: 1 } }, { key: "2", values: { take: 1 } }]
        const result = editableSchema(def, rows).safeParse(value)
        expect(result.success).toBe(false)
        if (!result.success) expect(toEditableErrors(result.error, value)["2"]).toEqual({ take: "Requiere producción" })
    })

    it("rejects an empty submission", () => {
        const value = [{ key: "1", values: { take: 0 } }, { key: "2", values: { take: 0 } }]
        expect(editableSchema(def, rows).safeParse(value).success).toBe(false)
    })
})
