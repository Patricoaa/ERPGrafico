import { useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'

const MAX_GROUP_BY_RECORDS = 5000

interface UseGroupByPaginationOptions<T> {
  pagedData: T[]
  totalCount: number
  groupBy: string | null
  allData: T[] | undefined
  allDataIsLoading: boolean
  maxRecords?: number
}

interface UseGroupByPaginationReturn<T> {
  displayData: T[]
  isGroupedBy: boolean
  isOverLimit: boolean
}

export function useGroupByPagination<T>({
  pagedData,
  totalCount,
  groupBy,
  allData,
  allDataIsLoading,
  maxRecords = MAX_GROUP_BY_RECORDS,
}: UseGroupByPaginationOptions<T>): UseGroupByPaginationReturn<T> {
  const wantsGrouping = groupBy !== null
  const overLimit = wantsGrouping && totalCount > maxRecords
  const warnedRef = useRef(false)

  useEffect(() => {
    if (overLimit && !warnedRef.current) {
      warnedRef.current = true
      toast.warning(
        `Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`,
      )
    }
    if (!overLimit) {
      warnedRef.current = false
    }
  }, [overLimit, totalCount])

  const displayData = useMemo(() => {
    if (!wantsGrouping) return pagedData
    if (overLimit) return pagedData
    if (allDataIsLoading || !allData) return []
    return allData
  }, [wantsGrouping, overLimit, pagedData, allData, allDataIsLoading])

  const isGroupedBy = wantsGrouping && !overLimit && !allDataIsLoading && !!allData

  return {
    displayData,
    isGroupedBy,
    isOverLimit: overLimit,
  }
}
