'use client'

import { useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Filter, Layers } from 'lucide-react'
import { useSegmentationTable } from '../SegmentationTableContext'
import { COLUMN_BLOCKLIST } from './DisplaySection'
import type {
  DropdownFilterDef,
  DateFilterDef,
  GroupByOptionDef,
  MultiSelectOption,
} from '@/types/unified-search'
import { FilterSection } from './FilterSection'
import { GroupBySection } from './GroupBySection'
import { DisplaySection } from './DisplaySection'

interface SearchBarMenuProps {
  filters?: DropdownFilterDef[]
  dateFilters?: DateFilterDef[]
  groupBy?: GroupByOptionDef[]
  paramValues: Record<string, string | null>
  currentGroupBy: string | null
  filterOptions?: Record<string, MultiSelectOption[]>
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
  onGroupBySelect: (key: string | null) => Promise<void>
  viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
  currentView?: string
  onViewChange?: (view: string) => void
}

export function SearchBarMenu({
  filters,
  dateFilters,
  groupBy,
  paramValues,
  currentGroupBy,
  filterOptions,
  onApply,
  onRemove,
  onGroupBySelect,
  viewOptions,
  currentView,
  onViewChange,
}: SearchBarMenuProps) {
  const table = useSegmentationTable()

  const hasFilters = (filters?.length ?? 0) > 0 || (dateFilters?.length ?? 0) > 0
  const hasGroupBy = (groupBy?.length ?? 0) > 0

  const sortableColumns = useMemo(() => {
    if (!table) return []
    return table.getAllColumns().filter(
      (column) => column.getCanSort() && column.columnDef.header,
    )
  }, [table])

  const hideableColumns = useMemo(() => {
    if (!table) return []
    return table.getAllColumns().filter(
      (column) => column.getCanHide() && !COLUMN_BLOCKLIST.has(column.id),
    )
  }, [table])

  const hasDisplaySection = (viewOptions?.length ?? 0) > 1 || sortableColumns.length > 0 || hideableColumns.length > 0

  const hasAnyContent = hasFilters || hasGroupBy || hasDisplaySection
  if (!hasAnyContent) return null

  const gridCols = hasDisplaySection ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className={`grid ${gridCols} gap-0`}>
      {/* Column 1: Filtrar por */}
      <div className="border-r border-border/60">
        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
          <Filter className="h-3 w-3" />
          Filtrar por
        </div>
        <ScrollArea className="max-h-[80vh]">
          <div className="p-1.5">
            <FilterSection
              filters={filters}
              dateFilters={dateFilters}
              paramValues={paramValues}
              filterOptions={filterOptions}
              onApply={onApply}
              onRemove={onRemove}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Column 2: Agrupar por */}
      <div className="border-r border-border/60">
        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
          <Layers className="h-3 w-3" />
          Agrupar por
        </div>
        <ScrollArea className="max-h-[80vh]">
          <div className="p-1.5">
            {hasGroupBy && groupBy && (
              <GroupBySection
                options={groupBy}
                currentGroupBy={currentGroupBy}
                onSelect={onGroupBySelect}
              />
            )}
            {!hasGroupBy && (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                No hay opciones de agrupación
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Column 3: Visualización (vista, sort, columnas) */}
      {hasDisplaySection && (
        <div>
          <DisplaySection
            viewOptions={viewOptions}
            currentView={currentView}
            onViewChange={onViewChange}
            sortableColumns={sortableColumns}
            hideableColumns={hideableColumns}
          />
        </div>
      )}
    </div>
  )
}
