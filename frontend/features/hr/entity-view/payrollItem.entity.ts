import { defineEditable, defineEntity } from "@/components/entity-view"
import { formatCurrency } from "@/lib/money"
import type { Payroll, PayrollAllocation, PayrollConcept, PayrollItem } from "@/types/hr"

const HABER = new Set(["HABER_IMPONIBLE", "HABER_NO_IMPONIBLE"])
const DESCUENTO = new Set(["DESCUENTO_LEGAL_TRABAJADOR", "OTRO_DESCUENTO"])

const num = (v: string | number | null | undefined) => {
    const n = parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? n : 0
}

// ─── Conceptos (haberes y descuentos en una sola tabla) ─────────────────────

/** Línea de la liquidación tal como se muestra/edita: `id` ausente = línea nueva aún no guardada. */
export interface PayrollLineRow {
    key: string
    id?: number
    concept: number
    conceptName: string
    kind: "HABER" | "DESCUENTO"
    categoryDisplay: string
    amount: number
    description: string
}

/** El concepto es un haber o un descuento del trabajador (los aportes del empleador no son líneas de la tabla). */
export function isPayrollLineCategory(category: string | undefined): boolean {
    return HABER.has(category ?? "") || DESCUENTO.has(category ?? "")
}

function lineKind(category: string | undefined): PayrollLineRow["kind"] {
    return HABER.has(category ?? "") ? "HABER" : "DESCUENTO"
}

export function payrollLineFromItem(item: PayrollItem): PayrollLineRow {
    return {
        key: `item-${item.id}`,
        id: item.id,
        concept: item.concept,
        conceptName: item.concept_detail?.name ?? "",
        kind: lineKind(item.concept_detail?.category),
        categoryDisplay: item.concept_detail?.category_display ?? "",
        amount: num(item.amount),
        description: item.description ?? "",
    }
}

export function payrollLineFromConcept(concept: PayrollConcept, key: string): PayrollLineRow {
    return {
        key,
        concept: concept.id,
        conceptName: concept.name,
        kind: lineKind(concept.category),
        categoryDisplay: concept.category_display,
        amount: concept.formula_type === "FIXED" ? num(concept.default_amount) : 0,
        description: "",
    }
}

/** Haberes primero, luego descuentos; dentro de cada grupo, el orden del backend. */
export function payrollLines(payroll: Payroll): PayrollLineRow[] {
    const lines = (payroll.items ?? []).filter(i => isPayrollLineCategory(i.concept_detail?.category)).map(payrollLineFromItem)
    return [...lines.filter(l => l.kind === "HABER"), ...lines.filter(l => l.kind === "DESCUENTO")]
}

export const payrollLineEntity = defineEntity<PayrollLineRow>()((f) => ({
    title: "Conceptos",
    rowId: (r) => r.key,
    fields: {
        concept: f.text("conceptName", { label: "Concepto", sortable: false }),
        type: f.text((r) => (r.kind === "HABER" ? "Haber" : "Descuento"), { label: "Tipo", tone: "secondary", sortable: false }),
        category: f.text("categoryDisplay", { label: "Categoría", tone: "secondary", sortable: false }),
        amount: f.money((r) => (r.kind === "DESCUENTO" ? -r.amount : r.amount), { label: "Monto", sortable: false }),
    },
}))

export const payrollLineViews = payrollLineEntity.views({
    table: { columns: ["concept", "type", "category", "amount"] },
})

/** Edición en línea del borrador: observación y monto por concepto. */
export const payrollLineEditable = defineEditable(payrollLineEntity, {
    rowKey: (r) => r.key,
    context: ["concept", "type", "category"],
    inputs: {
        amount: {
            kind: "money",
            header: "Monto",
            label: (r) => `Monto — ${r.conceptName}`,
            step: () => 1,
            initial: (r) => r.amount,
        },
    },
})

// ─── Anticipos y préstamos asignados ────────────────────────────────────────

/** Anticipo o cuota de préstamo descontada en la liquidación: `allocationId` ausente = asignación nueva. */
export interface PayrollAdvanceRow {
    key: string
    allocationId?: number
    movement: number
    displayId: string
    kindDisplay: string
    detail: string
    amount: number
    /** Monto ya asignado a esta liquidación (0 si es nueva). */
    assigned: number
    /** Tope del descuento: saldo libre del movimiento más lo ya asignado. */
    max: number
}

export function payrollAdvanceFromAllocation(a: PayrollAllocation): PayrollAdvanceRow {
    const interest = num(a.interest_part)
    return {
        key: `alloc-${a.id}`,
        allocationId: a.id,
        movement: a.movement,
        displayId: a.movement_display_id,
        kindDisplay: a.installment_number ? `${a.kind_display} · cuota ${a.installment_number}` : a.kind_display,
        detail: interest > 0 ? `Capital ${formatCurrency(num(a.principal_part))} · Interés ${formatCurrency(interest)}` : "",
        amount: num(a.amount),
        assigned: num(a.amount),
        max: num(a.amount),
    }
}

/** Solo anticipos y préstamos: los pagos de remuneración también son asignaciones, pero se ven en Pagos. */
export function payrollAdvances(payroll: Payroll): PayrollAdvanceRow[] {
    return (payroll.allocations ?? [])
        .filter(a => a.kind !== "PAYMENT" && a.movement_status !== "CANCELLED")
        .map(payrollAdvanceFromAllocation)
}

export const payrollAdvanceEntity = defineEntity<PayrollAdvanceRow>()((f) => ({
    title: "Anticipos y préstamos",
    rowId: (r) => r.key,
    fields: {
        movement: f.code("displayId", { label: "Movimiento", sortable: false }),
        kind: f.text("kindDisplay", { label: "Tipo", tone: "secondary", sortable: false }),
        detail: f.text("detail", { label: "Detalle", tone: "secondary", sortable: false }),
        amount: f.money("amount", { label: "Descuento", sortable: false }),
    },
}))

export const payrollAdvanceViews = payrollAdvanceEntity.views({
    table: { columns: ["movement", "kind", "detail", "amount"], footer: { sum: ["amount"] } },
})

export const payrollAdvanceEditable = defineEditable(payrollAdvanceEntity, {
    rowKey: (r) => r.key,
    context: ["movement", "kind", "detail"],
    inputs: {
        amount: {
            kind: "money",
            header: "Descuento",
            label: (r) => `Monto a descontar — ${r.displayId}`,
            step: () => 1,
            max: (r) => r.max,
            initial: (r) => r.amount,
        },
    },
    footer: { sum: ["amount"] },
})
