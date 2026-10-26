"use client"

/**
 * useEntityRouteActions
 *
 * Centralises the query-param convention for entity row/card actions.
 *
 *   ?selected={id}            → edit modal  (ADR-0020, list-modal-edit-pattern.md)
 *   ?selected={id}&action=view → view-only drawer (ADR-0028)
 *   ?selected={id}&action=X   → action-specific drawer (deposit, amortization, etc.)
 *
 * `?hub` was removed with the Order Hub (ADR-0083): documents open their document sheet via
 * `?selected` (`useDocumentSheetRoute`).
 * `?action` is only valid alongside `?selected`.
 * `?detail={id}` is DEPRECATED — use `openView(id)` instead.
 *
 * @contract docs/20-contracts/component-row-actions.md §5.3
 */

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useOptionalGlobalModalActions } from '@/components/providers/GlobalModalProvider'

const ROUTE_ACTION_PARAMS = ['selected'] as const
const ACTION_PARAM = 'action' // ?action= is only valid alongside ?selected=

export type EntityRouteActionParam = typeof ROUTE_ACTION_PARAMS[number]

export interface UseEntityRouteActionsResult {
    /** Currently active entity id for `?selected`, or null */
    selectedId: string | null
    /** Currently active value for `?action` (e.g. 'view', 'deposit'), or null */
    viewAction: string | null

    /** Open the edit modal for `id` via `?selected={id}` (push). */
    openSelected: (id: number | string) => void
    /** Open a view-only drawer via `?selected={id}&action=view` (push). */
    openView: (id: number | string) => void
    /** Open a drawer with a specific action via `?selected={id}&action={action}` (push). */
    openAction: (id: number | string, action: string) => void
    /** @deprecated Use `openView(id)` instead. */
    openDetail: (id: number | string) => void

    /**
     * Remove every entity-action param (selected/action) while preserving
     * any other param (filters, pagination, viewMode, etc).
     * Uses `router.replace` — no history entry.
     */
    clearActions: () => void
}

export function useEntityRouteActions(): UseEntityRouteActionsResult {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    // Guarda de cambios sin guardar: cerrar o cambiar de registro con un formulario sucio pregunta primero.
    const runGuarded = useOptionalGlobalModalActions()?.runGuarded

    const selectedId = searchParams.get('selected')
    // ?action= is only meaningful when ?selected= is present
    const viewAction = selectedId ? searchParams.get(ACTION_PARAM) : null

    const buildUrl = useCallback(
        (param: EntityRouteActionParam, id: number | string, action?: string) => {
            const params = new URLSearchParams(searchParams.toString())
            // Mutual exclusion: clear sibling action params before setting the new one
            for (const p of ROUTE_ACTION_PARAMS) {
                if (p !== param) params.delete(p)
            }
            params.set(param, String(id))
            // Set or clear ?action= alongside ?selected=
            if (param === 'selected' && action) {
                params.set(ACTION_PARAM, action)
            } else if (param === 'selected' && !action) {
                params.delete(ACTION_PARAM)
            }
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams],
    )

    const guarded = useCallback(
        (action: () => void) => (runGuarded ? runGuarded(action) : action()),
        [runGuarded],
    )

    const openSelected = useCallback(
        (id: number | string) => guarded(() => router.push(buildUrl('selected', id), { scroll: false })),
        [router, buildUrl, guarded],
    )

    const openView = useCallback(
        (id: number | string) => guarded(() => router.push(buildUrl('selected', id, 'view'), { scroll: false })),
        [router, buildUrl, guarded],
    )

    const openAction = useCallback(
        (id: number | string, action: string) =>
            guarded(() => router.push(buildUrl('selected', id, action), { scroll: false })),
        [router, buildUrl, guarded],
    )

    /** @deprecated Use `openView(id)` instead. */
    const openDetail = useCallback(
        (id: number | string) => guarded(() => router.push(buildUrl('selected', id, 'view'), { scroll: false })),
        [router, buildUrl, guarded],
    )

    const clearActions = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        let changed = false
        for (const p of ROUTE_ACTION_PARAMS) {
            if (params.has(p)) {
                params.delete(p)
                changed = true
            }
        }
        if (params.has(ACTION_PARAM)) {
            params.delete(ACTION_PARAM)
            changed = true
        }
        if (!changed) return
        const query = params.toString()
        guarded(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
    }, [router, pathname, searchParams, guarded])

    return useMemo(
        () => ({
            selectedId,
            viewAction,
            openSelected,
            openView,
            openAction,
            openDetail,
            clearActions,
        }),
        [selectedId, viewAction, openSelected, openView, openAction, openDetail, clearActions],
    )
}
