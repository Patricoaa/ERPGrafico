/**
 * Canonical paginated-result type. Required as the return shape of
 * every feature hook/api method that consumes a paginated DRF endpoint.
 * See: docs/20-contracts/pagination-contract.md
 */
export interface Page<T> {
    results: T[]
    count: number
    pageSize: number
    pageIndex: number
    hasNextPage: boolean
    hasPrevPage: boolean
}

export interface PageParams {
    page?: number
    page_size?: number
}

interface DrfEnvelope<T> {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}

function isDrfEnvelope<T>(value: unknown): value is DrfEnvelope<T> {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    return (
        typeof v.count === 'number' &&
        Array.isArray(v.results) &&
        (v.next === null || typeof v.next === 'string') &&
        (v.previous === null || typeof v.previous === 'string')
    )
}

/**
 * Wrap a DRF paginated response into a Page<T>. Throws if the backend
 * returned T[] for an endpoint declared as paginated — that's a contract
 * violation (pagination-contract.md §1.1) and must surface, not be hidden.
 */
export function toPage<T>(envelope: unknown, pageIndex: number, pageSize: number): Page<T> {
    if (!isDrfEnvelope<T>(envelope)) {
        throw new Error(
            'Backend did not return the {count, next, previous, results} envelope. ' +
            'See docs/20-contracts/pagination-contract.md §1.1.',
        )
    }
    return {
        results: envelope.results,
        count: envelope.count,
        pageSize,
        pageIndex,
        hasNextPage: !!envelope.next,
        hasPrevPage: !!envelope.previous,
    }
}

/** Empty page placeholder for `useQuery` skeleton states. */
export function emptyPage<T>(pageSize = 50): Page<T> {
    return {
        results: [],
        count: 0,
        pageSize,
        pageIndex: 1,
        hasNextPage: false,
        hasPrevPage: false,
    }
}
