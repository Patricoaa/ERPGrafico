"use client"

/**
 * useEntityRouteActions
 *
 * Centralises the query-param convention for entity row/card actions.
 *
 *   ?selected={id}  → edit modal       (ADR-0020, list-modal-edit-pattern.md)
 *   ?detail={id}    → TransactionViewModal (read-only)
 *   ?hub={id}       → HUB sheet (CollapsibleSheet)
 *
 * The three params are mutually exclusive — opening one closes the others.
 * `?view=` is NOT touched here (reserved for viewMode switch — see useViewMode).
 *
 * @contract docs/20-contracts/component-row-actions.md §5.3
 */

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const ROUTE_ACTION_PARAMS = ['selected', 'detail', 'hub'] as const

export type EntityRouteActionParam = typeof ROUTE_ACTION_PARAMS[number]

export interface UseEntityRouteActionsResult {
    /** Currently active entity id for `?selected`, or null */
    selectedId: string | null
    /** Currently active entity id for `?detail`, or null */
    detailId: string | null
    /** Currently active entity id for `?hub`, or null */
    hubId: string | null

    /** Open the edit modal for `id` via `?selected={id}` (push). */
    openSelected: (id: number | string) => void
    /** Open the read-only transaction modal via `?detail={id}` (push). */
    openDetail: (id: number | string) => void
    /** Open the HUB sheet via `?hub={id}` (push). */
    openHub: (id: number | string) => void

    /**
     * Remove every entity-action param (selected/detail/hub) while preserving
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
    const detailId = searchParams.get('detail')
    const hubId = searchParams.get('hub')

    const buildUrl = useCallback(
        (param: EntityRouteActionParam, id: number | string) => {
            const params = new URLSearchParams(searchParams.toString())
            // Mutual exclusion: clear sibling action params before setting the new one
            for (const p of ROUTE_ACTION_PARAMS) {
                if (p !== param) params.delete(p)
            }
            params.set(param, String(id))
            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams],
    )

    const openSelected = useCallback(
        (id: number | string) => router.push(buildUrl('selected', id), { scroll: false }),
        [router, buildUrl],
    )

    const openDetail = useCallback(
        (id: number | string) => router.push(buildUrl('detail', id), { scroll: false }),
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
        if (!changed) return
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    return useMemo(
        () => ({
            selectedId,
            detailId,
            hubId,
            openSelected,
            openDetail,
            openHub,
            clearActions,
        }),
        [selectedId, detailId, hubId, openSelected, openDetail, openHub, clearActions],
    )
}
