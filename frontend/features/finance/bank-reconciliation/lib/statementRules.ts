import type { BankStatement } from "../types"

/**
 * Reglas de acción sobre una cartola. Espejo de `BankStatementService` en backend
 * (`edit_block_reason` / `delete_block_reason`): la UI oculta o deshabilita, el backend valida.
 */

type StatementFacts = Pick<BankStatement, "state" | "touched_lines">

/** Solo borradores sin trabajo de conciliación: no hay líneas conciliadas ni excluidas. */
export function canDeleteStatement(statement: StatementFacts): boolean {
    return statement.state === "DRAFT" && (statement.touched_lines ?? 0) === 0
}

/** La mesa de conciliación trabaja cartolas abiertas que aún no están al 100 %. */
export function canReconcileStatement(statement: Pick<BankStatement, "state" | "reconciliation_progress">): boolean {
    return statement.state !== "CONFIRMED" && statement.state !== "CANCELLED" && statement.reconciliation_progress < 100
}

/** Motivo visible cuando una acción de borrado no aplica (para el menú deshabilitado). */
export function deleteBlockedReason(statement: StatementFacts): string | null {
    if (statement.state !== "DRAFT") return "Solo se elimina una cartola en borrador."
    if ((statement.touched_lines ?? 0) > 0) return "Tiene líneas conciliadas o excluidas. Deshaz esos cambios primero."
    return null
}
