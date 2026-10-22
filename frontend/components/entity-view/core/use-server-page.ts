"use client"

import * as React from "react"
import { hashKey } from "@tanstack/react-query"
import type { PaginationState } from "@tanstack/react-table"

/**
 * Page state of a server-paginated list that belongs to one query shape (filters, sort, grouping…).
 * When the shape changes the list starts again at `initial`: otherwise a new filter or sort keeps the
 * old page index and shows an arbitrary slice, or a page that no longer exists (DRF 404).
 * Derived, no effect: the stored page is simply ignored while it belongs to another shape.
 */
export function useServerPage(shape: unknown, initial: PaginationState): [PaginationState, (next: PaginationState) => void] {
    const key = hashKey([shape])
    const [paging, setPaging] = React.useState({ key, page: initial })
    const page = paging.key === key ? paging.page : initial
    const setPage = React.useCallback((next: PaginationState) => setPaging({ key, page: next }), [key])
    return [page, setPage]
}
