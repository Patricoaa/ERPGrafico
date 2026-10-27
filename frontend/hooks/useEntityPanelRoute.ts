"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

export interface UseEntityPanelRouteOptions {
    /**
     * Endpoint del que se carga el registro de `?selected` (`useSelectedEntity`). Sin él, el panel se abre
     * con solo el id y la vista resuelve el registro (filas de la lista, drawers que cargan por id).
     */
    endpoint?: string
    /**
     * Valores de `?action` que abren este panel; `null` = sin `?action`. Sin lista, cualquier acción.
     * Permite varios paneles sobre un mismo `?selected` (`["view"]`, `["disburse"]`, `[null, "detail"]`).
     */
    actions?: readonly (string | null)[]
    /** Query param de la selección. Default `selected`; otro nombre cuando una página tiene dos entidades (`selected-device`). */
    selectedParam?: string
    /** Valor de `?modal=` que abre la creación. Default `new` (`new-device`…). */
    createValue?: string
    /** `?modal=new` / `external` abren este panel en creación. Default `true`; `false` para paneles solo de selección. */
    create?: boolean
    /** Apertura por estado de la página (botón "Nuevo" que no pasa por la URL). */
    external?: { open?: boolean; onOpenChange?: (open: boolean) => void }
    /** Falso mientras el panel no aplica (p. ej. otra pestaña de la página activa): nunca se abre. */
    enabled?: boolean
    /** Falso si la selección aún no tiene datos que mostrar (la vista los resuelve de sus filas): no se abre. */
    resolved?: boolean
}

export interface EntityPanelRoute<T> {
    /** Id de `?selected` que corresponde a este panel (según `actions`), o null. */
    selectedId: number | null
    /** Registro cargado desde `endpoint`, o null. */
    entity: T | null
    isLoading: boolean
    /** El panel está abierto en creación. */
    isCreate: boolean
    open: boolean
    /** Cierra el panel: quita la selección, `action` y su `modal` de la URL (con guarda de cambios sin guardar). */
    close: () => void
    /** Props de `EntityPanelTab`: `<EntityPanelTab label="…" {...panel.tab}>`. */
    tab: { id: number | null; open: boolean; onClose: () => void }
}

/**
 * Estado de ruta de un drawer de entidad montado por la página (ADR-0020 + ADR-0101): `?selected` (+`?action`)
 * para ver/editar, `?modal=new` o `external` para crear. Es la única implementación de "abrir, cargar y
 * cerrar" que alimenta a `EntityPanelTab`; las vistas no vuelven a escribir su `handleClose`.
 */
export function useEntityPanelRoute<T = unknown>({
    endpoint,
    actions,
    selectedParam = "selected",
    createValue = "new",
    create = true,
    external,
    enabled = true,
    resolved = true,
}: UseEntityPanelRouteOptions = {}): EntityPanelRoute<T> {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const runGuarded = useOptionalGlobalModalActions()?.runGuarded

    const action = searchParams.get("action")
    const rawId = Number(searchParams.get(selectedParam)) || null
    const actionMatches = !actions || actions.includes(action)
    const selectedId = enabled && actionMatches ? rawId : null

    const { entity, isLoading } = useSelectedEntity<T>({ endpoint: selectedId ? endpoint ?? null : null, paramName: selectedParam })

    const isCreate = enabled && create && (searchParams.get("modal") === createValue || !!external?.open)
    const hasSelection = selectedId !== null && resolved && (!endpoint || entity !== null)
    const open = isCreate || hasSelection

    const onExternalOpenChange = external?.onOpenChange
    const close = useCallback(() => {
        const run = () => {
            onExternalOpenChange?.(false)
            const params = new URLSearchParams(searchParams.toString())
            params.delete(selectedParam)
            if (selectedParam === "selected") params.delete("action")
            if (searchParams.get("modal") === createValue) params.delete("modal")
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
        if (runGuarded) runGuarded(run)
        else run()
    }, [runGuarded, onExternalOpenChange, searchParams, router, pathname, selectedParam, createValue])

    const id = isCreate ? null : selectedId
    const tab = useMemo(() => ({ id, open, onClose: close }), [id, open, close])
    return { selectedId, entity, isLoading, isCreate, open, close, tab }
}
