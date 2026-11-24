import type { DocumentRelations } from "../types"

/** Total real de relaciones: las visibles más las que la ventana reciente dejó fuera (ADR-0155). */
export function relationsTotal(data: Pick<DocumentRelations, "relations"> & Partial<Pick<DocumentRelations, "hidden">> | undefined): number | undefined {
    if (!data) return undefined
    return data.relations.length + Object.values(data.hidden ?? {}).reduce((sum, n) => sum + n, 0)
}
