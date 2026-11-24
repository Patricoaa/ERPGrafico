/**
 * Pila de navegación del panel de ventas del POS. La entrada raíz (OV, nota, sesión) se incrusta en el
 * panel; toda entidad que se abra desde ahí (links, pestaña Relaciones) se apila y se monta cubriendo al
 * padre (`DrawerScope.cover`). «Volver» / X quita la cima y revela la entrada anterior. Sin límite de niveles.
 */

/** Documentos que se incrustan en el panel cuando son la raíz de la pila. */
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
 * Añade una entrada encima de la pila (cualquier entidad, incluidos documentos de panel). Si ya es la
 * cima no hace nada (doble clic). Abrir de nuevo una entrada que está más abajo la lleva a la cima sin
 * duplicarla: se recorta la pila hasta ella.
 */
export function pushEntry(state: StackState, entry: Omit<StackEntry, "key">): StackState {
    const key = entryKey(entry.label, entry.id)
    const top = state.entries[state.entries.length - 1]
    if (top && top.key === key) return state
    const existing = state.entries.findIndex(e => e.key === key)
    if (existing !== -1) return { entries: state.entries.slice(0, existing + 1), direction: "back" }
    return { entries: [...state.entries, { ...entry, key }], direction: "forward" }
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

/** Documento que ocupa el panel: la raíz de la pila, si es un documento de panel. */
export function paneEntryOf(entries: readonly StackEntry[]): StackEntry | null {
    return entries.length > 0 && isPaneLabel(entries[0].label) ? entries[0] : null
}

/** Entidades que cubren al panel, de la más antigua a la cima (todo lo que no es la raíz incrustada). */
export function overlayEntriesOf(entries: readonly StackEntry[]): readonly StackEntry[] {
    return paneEntryOf(entries) ? entries.slice(1) : entries
}
