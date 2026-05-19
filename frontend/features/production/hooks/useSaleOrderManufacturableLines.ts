import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SaleOrderLine } from '@/features/sales'

const EMPTY_SALE_LINE_VALUES = new Set(['', 'none', '__none__'])

export function useSaleOrderManufacturableLines(
  saleOrderId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<SaleOrderLine[]>({
    queryKey: ['saleOrderLines', saleOrderId],
    queryFn: async () => {
      if (!saleOrderId) return []
      const res = await api.get(`/sales/orders/${saleOrderId}/`)
      const lines: SaleOrderLine[] = res.data.lines ?? []
      return lines.filter(
        (l) =>
          l.product_type === 'MANUFACTURABLE' &&
          l.requires_advanced_manufacturing &&
          !l.work_order_summary
      )
    },
    enabled:
      (options.enabled ?? true) &&
      !!saleOrderId &&
      !EMPTY_SALE_LINE_VALUES.has(saleOrderId ?? ''),
  })
}
