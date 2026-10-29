/**
 * Registro de formularios con cambios sin guardar (guarda estricta de drill-down).
 *
 * Cada formulario de drawer se registra mientras está abierto (`useDirtyGuard`); el provider
 * consulta el registro antes de abrir otro documento, cerrar o volver, y muestra el diálogo
 * Guardar / Descartar / Seguir editando.
 */
export interface DirtyEntry {
    /** Nombre mostrado en el diálogo (p. ej. "OV-000183"); sin él se usa un texto genérico. */
    name?: string
    isDirty: () => boolean
    /** Envía el formulario. `true` solo si quedó guardado (falla de validación o de API → `false`). */
    save: () => Promise<boolean>
    /** Descarta los cambios (reset al estado inicial). */
    discard: () => void
    /** Hay un envío del formulario en curso: un cierre pedido ahora es el del guardado. */
    isSubmitting?: () => boolean
    /** Fin del último envío (ms epoch, 0 = nunca): detecta cierres que escaparon de la ventana del envío. */
    submittedAt?: () => number
}

export class DirtyRegistry {
    private entries = new Map<symbol, DirtyEntry>()

    register(entry: DirtyEntry): () => void {
        const key = Symbol("dirty-entry")
        this.entries.set(key, entry)
        return () => { this.entries.delete(key) }
    }

    dirtyEntries(): DirtyEntry[] {
        return [...this.entries.values()].filter((e) => e.isDirty())
    }

    hasDirty(): boolean {
        return this.dirtyEntries().length > 0
    }

    isSubmitting(): boolean {
        return [...this.entries.values()].some((e) => e.isSubmitting?.() ?? false)
    }
}
