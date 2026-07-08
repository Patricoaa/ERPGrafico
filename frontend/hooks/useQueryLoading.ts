import { useMemo } from "react"

interface UseQueryLoadingResult {
    showSkeleton: boolean
    isRefetching: boolean
}

export function useQueryLoading(
    isLoading: boolean,
    isFetching: boolean,
    dataLength: number
): UseQueryLoadingResult {
    return useMemo(() => {
        const showSkeleton = isLoading && !dataLength
        const isRefetching = isFetching && !showSkeleton
        return { showSkeleton, isRefetching }
    }, [isLoading, isFetching, dataLength])
}
