import { useMemo } from "react"

interface PaginatedFiltersResult<TFilters extends Record<string, unknown>> {
    page: number
    pageSize: number
    activeFilters: TFilters & { page: number; page_size: number }
}

export function usePaginatedFilters<TFilters extends Record<string, unknown>>(
    filters?: TFilters | null
): PaginatedFiltersResult<TFilters> {
    return useMemo(() => {
        const { page = 1, page_size = 50, ...restFilters } = (filters ?? {}) as TFilters & {
            page?: number
            page_size?: number
        }
        const activeFilters = { page, page_size, ...restFilters } as TFilters & {
            page: number
            page_size: number
        }
        return { page, pageSize: page_size, activeFilters }
    }, [filters])
}
