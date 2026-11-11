/**
 * Pila de navegación del panel de ventas del POS (opción B). Cada entrada es un documento o un maestro
 * abierto desde el panel. Los documentos de `PANE_LABELS` se muestran en el panel derecho; el resto
 * (producto, contacto, OT…) se muestra como drawer anidado encima del panel. «Volver» quita la cima.
 */

/** Documentos que se renderizan dentro del panel (ficha incrustada). */
export const PANE_LABELS: ReadonlySet<string> = new Set(["sales.saleorder", "billing.invoice", "treasury.possession"])

export interface StackEntry {
    key: string
    label: string
    id: number
    /** Título de la entrada mientras la ficha no conoce su número (botón «Volver a …»). */
    display?: string
    data?: unknown
}

export type StackDirection = "forward" | "back"

export interface StackState {
    entries: readonly StackEntry[]
    direction: StackDirection
}

export const EMPTY_STACK: StackState = { entries: [], direction: "forward" }

export function entryKey(label: string, id: number): string {
    return `${label}:${id}`
}

export function isPaneLabel(label: string): boolean {
    return PANE_LABELS.has(label)
}

/**
 * Añade una entrada. Un documento de panel (OV, nota) **reemplaza** lo abierto: no hay drill-back por
 * cada documento. Un drawer anidado (producto, contacto…) reemplaza al anterior drawer anidado: nunca hay
 * más de un documento y un drawer anidado a la vez, así no se abre una cadena de drawers.
 * Si la entrada ya es la cima, no hace nada (doble clic).
 */
export function pushEntry(state: StackState, entry: Omit<StackEntry, "key">): StackState {
    const key = entryKey(entry.label, entry.id)
    const top = state.entries[state.entries.length - 1]
    if (top && top.key === key) return state
    if (isPaneLabel(entry.label)) return { entries: [{ ...entry, key }], direction: "forward" }
    // Un único drawer anidado: el nuevo reemplaza al anterior en lugar de apilarse.
    const documents = state.entries.filter(e => isPaneLabel(e.label))
    return { entries: [...documents, { ...entry, key }], direction: "forward" }
}

/** «Volver»: quita la cima. Vacía no cambia nada. */
export function popEntry(state: StackState): StackState {
    if (state.entries.length === 0) return state
    return { entries: state.entries.slice(0, -1), direction: "back" }
}

/** Selección de la lista: reemplaza toda la pila por la fila elegida (o la limpia con `null`). */
export function setRootEntry(state: StackState, entry: Omit<StackEntry, "key"> | null): StackState {
    if (!entry) return state.entries.length === 0 ? state : { entries: [], direction: "back" }
    const key = entryKey(entry.label, entry.id)
    if (state.entries.length === 1 && state.entries[0].key === key) return state
    return { entries: [{ ...entry, key }], direction: "forward" }
}

/** Documento que ocupa el panel: el último de tipo panel (aunque haya un maestro encima). */
export function paneEntryOf(entries: readonly StackEntry[]): StackEntry | null {
    for (let i = entries.length - 1; i >= 0; i--) {
        if (isPaneLabel(entries[i].label)) return entries[i]
    }
    return null
}

/** Drawer anidado a mostrar: la cima, si no es un documento de panel. */
export function overlayEntryOf(entries: readonly StackEntry[]): StackEntry | null {
    const top = entries[entries.length - 1]
    return top && !isPaneLabel(top.label) ? top : null
}
