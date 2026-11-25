'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UnifiedChip } from '@/types/unified-search'
import { formatResultCount } from './ResultCountContext'

export function formatChipLabel(chip: UnifiedChip): string {
  if (chip.variant === 'group') return `Agrupado por ${chip.valueLabel}`
  if (chip.variant === 'search') return chip.valueLabel
  return `${chip.label}: ${chip.valueLabel}`
}

const CHIP_TONE: Record<UnifiedChip['variant'], string> = {
  search: 'bg-muted text-muted-foreground',
  filter: 'bg-primary/10 text-primary',
  date: 'bg-info/10 text-info',
  range: 'bg-warning/10 text-warning-text',
  group: 'bg-pantone-violet/10 text-pantone-violet',
}

interface AppliedFiltersProps {
  chips: UnifiedChip[]
  /** Omitted: the row is read-only (no remove buttons, no «Limpiar todo»), e.g. the analytics scope strip. */
  onClearAll?: () => void
  /** Collection total; shown at the end of the row ("38 resultados"). `null` = unknown. */
  resultCount?: number | null
  className?: string
}

/**
 * Applied-filters row (ADR-0158, collection-toolbar §5.2): one removable chip per active filter,
 * search or grouping, wrapping onto new lines (never scrolling sideways), then "Limpiar todo" and
 * the result count. Renders nothing while no chip is active.
 */
export function AppliedFilters({ chips, onClearAll, resultCount = null, className }: AppliedFiltersProps) {
  if (chips.length === 0) return null
  const editable = onClearAll !== undefined

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <ul aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => {
          const label = formatChipLabel(chip)
          return (
            <li
              key={chip.id}
              className={cn(
                'inline-flex h-5 max-w-[240px] items-center gap-1 rounded-full pl-2 text-2xs font-medium whitespace-nowrap',
                editable ? 'pr-0.5' : 'pr-2',
                CHIP_TONE[chip.variant],
              )}
            >
              <span className="truncate" title={label}>{label}</span>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${label}`}
                  onClick={chip.onRemove}
                  className="size-4 shrink-0 rounded-full p-0 hover:bg-foreground/10"
                >
                  <X className="size-2.5" aria-hidden />
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {editable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-5 px-1.5 text-2xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpiar todo
        </Button>
      )}

      {resultCount !== null && (
        <span aria-live="polite" className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground">
          {formatResultCount(resultCount)}
        </span>
      )}
    </div>
  )
}
