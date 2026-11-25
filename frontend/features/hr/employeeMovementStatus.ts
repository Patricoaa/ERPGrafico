import type { EmployeeMovementStatus } from "@/types/hr"

/**
 * Estados de un movimiento con empleado (pago de remuneración, anticipo, préstamo) y de un pago de
 * liquidación, con las mismas etiquetas que `EmployeeMovement.Status` / `PayrollPayment.Status` del
 * backend. Fuente única del front: filtros, tablas y badges usan esto (o el `status_display` del
 * backend), nunca el mapa global de `StatusBadge` («Publicado», «Liquidado», «Cancelado»).
 */
export const EMPLOYEE_MOVEMENT_STATUS_LABEL: Record<EmployeeMovementStatus, string> = {
    DRAFT: "Borrador",
    POSTED: "Contabilizado",
    SETTLED: "Saldado",
    CANCELLED: "Anulado",
}

export const EMPLOYEE_MOVEMENT_STATUS_OPTIONS = (Object.keys(EMPLOYEE_MOVEMENT_STATUS_LABEL) as EmployeeMovementStatus[])
    .map((value) => ({ value, label: EMPLOYEE_MOVEMENT_STATUS_LABEL[value] }))

/** Valor para `StatusBadge` / `f.status`: estado + etiqueta canónica (la del backend si llega). */
export function employeeMovementStatus(status: EmployeeMovementStatus, display?: string | null) {
    return { status, label: display || EMPLOYEE_MOVEMENT_STATUS_LABEL[status] }
}
