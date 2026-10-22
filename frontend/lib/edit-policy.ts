/** Fields the backend froze because the record already has history (ADR-0091). */
export function frozenFieldsOf(entity: unknown): ReadonlySet<string> {
    if (typeof entity !== "object" || entity === null || !("frozen_fields" in entity)) {
        return new Set()
    }
    const raw = entity.frozen_fields
    return new Set(Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [])
}

export const FROZEN_FIELD_HINT = "No se puede cambiar: el registro ya tiene movimientos contabilizados."
