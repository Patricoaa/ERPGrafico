import type { SegmentationDefinition } from '@/types/segmentation'

export type SegmentationFilterState = Record<string, string>

export interface UseSegmentationReturn {
  filters: SegmentationFilterState
  isFiltered: boolean
  apply: (serverParam: string, value: string) => Promise<void>
  remove: (serverParam: string) => Promise<void>
  clearAll: () => Promise<void>
  def: SegmentationDefinition
}
