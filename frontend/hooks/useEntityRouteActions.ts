"use client"

/**
 * useEntityRouteActions
 *
 * Centralises the query-param convention for entity row/card actions.
 *
 *   ?selected={id}            → edit modal  (ADR-0020, list-modal-edit-pattern.md)
 *   ?selected={id}&action=view → view-only drawer (ADR-0028)
 *   ?selected={id}&action=X   → action-specific drawer (deposit, amortization, etc.)
 *   ?hub={id}                 → HUB sheet (CollapsibleSheet)
 *
 * `?selected` and `?hub` are mutually exclusive — opening one closes the other.
 * `?action` is only valid alongside `?selected`.
 * `?detail={id}` is DEPRECATED — use `openView(id)` instead.
 *
 * @contract docs/20-contracts/component-row-actions.md §5.3
 */

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const ROUTE_ACTION_PARAMS = ['selected', 'hub'] as const
const ACTION_PARAM = 'action' // ?action= is only valid alongside ?selected=

export type EntityRouteActionParam = typeof ROUTE_ACTION_PARAMS[number]

export interface UseEntityRouteActionsResult {
    /** Currently active entity id for `?selected`, or null */
    selectedId: string | null
    /** Currently active value for `?action` (e.g. 'view', 'deposit'), or null */
    viewAction: string | null
    /** Currently active entity id for `?hub`, or null */
    hubId: string | null

    /** Open the edit modal for `id` via `?selected={id}` (push). */
    openSelected: (id: number | string) => void
    /** Open a view-only drawer via `?selected={id}&action=view` (push). */
    openView: (id: number | string) => void
    /** Open a drawer with a specific action via `?selected={id}&action={action}` (push). */
    openAction: (id: number | string, action: string) => void
    /** @deprecated Use `openView(id)` instead. */
    openDetail: (id: number | string) => void
    /** Open the HUB sheet via `?hub={id}` (push). */
    openHub: (id: number | string) => void

    /**
     * Remove every entity-action param (selected/action/hub) while preserving
     * any other param (filters, pagination, viewMode, etc).
     * Uses `router.replace` — no history entry.
     */
    clearActions: () => void
}

export function useEntityRouteActions(): UseEntityRouteActionsResult {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedId = searchParams.get('selected')
    const hubId = searchParams.get('hub')
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

    const openSelected = useCallback(
        (id: number | string) => router.push(buildUrl('selected', id), { scroll: false }),
        [router, buildUrl],
    )

    const openView = useCallback(
        (id: number | string) => router.push(buildUrl('selected', id, 'view'), { scroll: false }),
        [router, buildUrl],
    )

    const openAction = useCallback(
        (id: number | string, action: string) =>
            router.push(buildUrl('selected', id, action), { scroll: false }),
        [router, buildUrl],
    )

    /** @deprecated Use `openView(id)` instead. */
    const openDetail = useCallback(
        (id: number | string) => router.push(buildUrl('selected', id, 'view'), { scroll: false }),
        [router, buildUrl],
    )

    const openHub = useCallback(
        (id: number | string) => router.push(buildUrl('hub', id), { scroll: false }),
        [router, buildUrl],
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
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    return useMemo(
        () => ({
            selectedId,
            viewAction,
            hubId,
            openSelected,
            openView,
            openAction,
            openDetail,
            openHub,
            clearActions,
        }),
        [selectedId, viewAction, hubId, openSelected, openView, openAction, openDetail, openHub, clearActions],
    )
}
