'use client'

import { ArrowUp, ArrowDown, ArrowUpDown, List, LayoutDashboard, LayoutGrid, Kanban, CalendarDays, Columns3 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { translateColumnId } from '../DataTableColumnToggle'
import type { Column } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'

const VIEW_ICON_MAP: Record<string, LucideIcon> = {
  list: List,
  card: LayoutDashboard,
  grid: LayoutGrid,
  kanban: Kanban,
  timeline: CalendarDays,
}

interface DisplaySectionProps {
  viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
  currentView?: string
  onViewChange?: (view: string) => void
  sortableColumns: Column<unknown>[]
  hideableColumns: Column<unknown>[]
  showColumnToggle?: boolean
}

function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  )
}

function ViewModeSection({
  viewOptions,
  currentView,
  onViewChange,
}: {
  viewOptions: NonNullable<DisplaySectionProps['viewOptions']>
  currentView?: string
  onViewChange?: (view: string) => void
}) {
  return (
    <div>
      <SectionHeader icon={LayoutDashboard} label="Vista" />
      <ScrollArea className="max-h-[80vh]">
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {viewOptions.map((option) => {
            const Icon = VIEW_ICON_MAP[option.value] ?? option.icon
            const isActive = currentView === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onViewChange?.(option.value)}
                className={cn(
                  "w-full text-left flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-sm hover:bg-accent/50 transition-colors min-w-0",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function SortSection({ columns }: { columns: Column<unknown>[] }) {
  if (!columns.length) return null

  return (
    <div>
      <SectionHeader icon={ArrowUpDown} label="Ordenar por" />
      <ScrollArea className="max-h-[80vh]">
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {columns.map((column) => {
            const isSorted = column.getIsSorted()
            const title = (column.columnDef.meta as { title?: string })?.title || translateColumnId(column.id)
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className={cn(
                  "w-full text-left flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-sm hover:bg-accent/50 transition-colors min-w-0",
                  isSorted ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  {isSorted === 'desc' ? (
                    <ArrowDown className="h-3.5 w-3.5 text-primary" />
                  ) : isSorted === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                  )}
                </div>
                <span className="truncate">{title}</span>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

function ColumnVisibilitySection({ columns }: { columns: Column<unknown>[] }) {
  if (!columns.length) return null

  return (
    <div>
      <SectionHeader icon={Columns3} label="Columnas" />
      <ScrollArea className="max-h-[80vh]">
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {columns.map((column) => {
            const isVisible = column.getIsVisible()
            const title = (column.columnDef.meta as { title?: string })?.title || translateColumnId(column.id)
            return (
              <label
                key={column.id}
                className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-sm text-xs font-medium transition-colors min-w-0"
              >
                <Checkbox
                  variant="circle"
                  checked={isVisible}
                  onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                />
                <span className={cn("truncate", isVisible ? "text-foreground" : "text-muted-foreground")}>{title}</span>
              </label>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

const COLUMN_BLOCKLIST = new Set([
  'actions', 'select', 'hub_trigger',
  'production_status', 'logistics_status',
  'billing_status', 'treasury_status',
])

export function DisplaySection({
  viewOptions,
  currentView,
  onViewChange,
  sortableColumns,
  hideableColumns,
  showColumnToggle = true,
}: DisplaySectionProps) {
  const hasViewOptions = (viewOptions?.length ?? 0) > 1
  const hasSortOptions = sortableColumns.length > 0
  const hasColumnToggle = showColumnToggle && hideableColumns.length > 0

  if (!hasViewOptions && !hasSortOptions && !hasColumnToggle) return null

  return (
    <div>
      {hasViewOptions && viewOptions && (
        <div>
          <ViewModeSection
            viewOptions={viewOptions}
            currentView={currentView}
            onViewChange={onViewChange}
          />
        </div>
      )}

      {hasViewOptions && (hasSortOptions || hasColumnToggle) && (
        <div className="border-t border-border/60" />
      )}

      {hasSortOptions && (
        <div>
          <SortSection columns={sortableColumns} />
        </div>
      )}

      {hasSortOptions && hasColumnToggle && (
        <div className="border-t border-border/60" />
      )}

      {hasColumnToggle && (
        <div>
          <ColumnVisibilitySection columns={hideableColumns} />
        </div>
      )}
    </div>
  )
}

export { COLUMN_BLOCKLIST }
