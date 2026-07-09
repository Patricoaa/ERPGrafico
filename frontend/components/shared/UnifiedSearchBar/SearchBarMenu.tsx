'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Filter, Layers } from 'lucide-react'
import type {
  DropdownFilterDef,
  DateFilterDef,
  GroupByOptionDef,
} from '@/types/unified-search'
import { FilterSection } from './FilterSection'
import { GroupBySection } from './GroupBySection'

interface SearchBarMenuProps {
  filters?: DropdownFilterDef[]
  dateFilters?: DateFilterDef[]
  groupBy?: GroupByOptionDef[]
  paramValues: Record<string, string | null>
  currentGroupBy: string | null
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
  onGroupBySelect: (key: string | null) => Promise<void>
}

export function SearchBarMenu({
  filters,
  dateFilters,
  groupBy,
  paramValues,
  currentGroupBy,
  onApply,
  onRemove,
  onGroupBySelect,
}: SearchBarMenuProps) {
  const hasFilters = (filters?.length ?? 0) > 0 || (dateFilters?.length ?? 0) > 0
  const hasGroupBy = (groupBy?.length ?? 0) > 0

  if (!hasFilters && !hasGroupBy) return null

  return (
    <div className="grid grid-cols-2 gap-0 min-h-[200px]">
      {/* Left column: Filtrar por */}
      <div className="border-r border-border/60">
        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
          <Filter className="h-3 w-3" />
          Filtrar por
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-1.5">
            <FilterSection
              filters={filters}
              dateFilters={dateFilters}
              paramValues={paramValues}
              onApply={onApply}
              onRemove={onRemove}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Right column: Agrupar por */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
          <Layers className="h-3 w-3" />
          Agrupar por
        </div>
        <ScrollArea className="max-h-[320px]">
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
    </div>
  )
}
