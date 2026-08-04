import { useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'

const MAX_GROUP_BY_RECORDS = 5000

interface UseGroupByPaginationOptions {
  totalCount: number
  groupBy: string | null
  maxRecords?: number
}

interface UseGroupByPaginationReturn {
  isGrouping: boolean
  isOverLimit: boolean
  effectivePage: number
  effectivePageSize: number
  manualPagination: boolean
  currentGroupBy: string | null
}

export function useGroupByPagination({
  totalCount,
  groupBy,
  maxRecords = MAX_GROUP_BY_RECORDS,
  currentPageSize,
  currentPageIndex,
}: UseGroupByPaginationOptions & {
  currentPageSize: number
  currentPageIndex: number
}): UseGroupByPaginationReturn {
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

  const isGrouping = wantsGrouping && !overLimit

  return useMemo(() => ({
    isGrouping,
    isOverLimit: overLimit,
    effectivePage: isGrouping ? 1 : currentPageIndex + 1,
    effectivePageSize: isGrouping ? maxRecords : currentPageSize,
    manualPagination: !isGrouping,
    currentGroupBy: isGrouping ? groupBy : null,
  }), [isGrouping, overLimit, currentPageIndex, currentPageSize, maxRecords, groupBy])
}
