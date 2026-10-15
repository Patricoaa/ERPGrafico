import type { Action, ActionRegistry } from "@/types/actions"

/** Acción del registro ya evaluada contra el documento y los permisos (ADR-0083). */
export interface ResolvedDocumentAction<T> {
    action: Action<T>
    /** Id de la categoría del registro (documents, payments…). */
    category: string
    disabled: boolean
    disabledReason?: string
}

/**
 * Evalúa un registro de acciones (`features/<x>/actions.tsx`) contra un documento: permisos
 * (basta uno de los requeridos), estado excluido/requerido y `checkAvailability`. Mismas reglas
 * que PhaseCard del Order Hub. Un id repetido en varias categorías se queda con la primera.
 */
export function resolveRegistryActions<T extends object>(
    registry: ActionRegistry<T>,
    doc: T | null | undefined,
    permissions: string[],
    exclude?: (actionId: string) => boolean,
): ResolvedDocumentAction<T>[] {
    if (!doc) return []
    const status = (doc as { status?: string }).status ?? ""
    const seen = new Set<string>()
    const resolved: ResolvedDocumentAction<T>[] = []
    for (const [category, { actions }] of Object.entries(registry)) {
        for (const action of actions) {
            if (seen.has(action.id) || exclude?.(action.id)) continue
            if (action.requiredPermissions && !action.requiredPermissions.some((p) => permissions.includes(p))) continue
            if (action.excludedStatus?.includes(status)) continue
            if (action.requiredStatus && !action.requiredStatus.includes(status)) continue
            if (action.checkAvailability && !action.checkAvailability(doc)) continue
            seen.add(action.id)
            const disabled = action.isDisabled?.(doc) ?? false
            const reason = typeof action.disabledTooltip === "function" ? action.disabledTooltip(doc) : action.disabledTooltip
            resolved.push({ action, category, disabled, disabledReason: disabled ? reason : undefined })
        }
    }
    return resolved
}
