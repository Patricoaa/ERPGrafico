import type { BankStatementLine, ReconciliationBatch, ReconciliationMovement } from "../types"

/** Grupo de conciliación de una o más líneas bancarias (serializado por el backend). */
export interface ReconGroupData {
    id: number
    movements: ReconciliationMovement[]
    batches: ReconciliationBatch[]
    difference_amount: number
    difference_type: string
    difference_type_display: string
    difference_journal_entry?: number
}

export interface ReconciledGroup {
    /** Clave estable: `group-{id}` para grupos reales, `line-{id}` para líneas sin grupo. */
    key: string
    /** `null` cuando la línea está marcada como conciliada pero no tiene grupo asociado. */
    group: ReconGroupData | null
    lines: BankStatementLine[]
}

/**
 * Agrupa las líneas conciliadas por su grupo de conciliación. Una línea sin grupo no se descarta:
 * queda como grupo propio sin movimientos, para que el operador la vea y pueda revisarla.
 */
export function buildReconciledGroups(lines: BankStatementLine[]): ReconciledGroup[] {
    const groups = new Map<string, ReconciledGroup>()
    for (const line of lines) {
        const data = line.reconciliation_group_data
        const key = data ? `group-${data.id}` : `line-${line.id}`
        const entry = groups.get(key)
        if (entry) {
            entry.lines.push(line)
        } else {
            groups.set(key, { key, group: data ?? null, lines: [line] })
        }
    }
    return [...groups.values()]
}
