'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { SearchBarMenu } from './SearchBarMenu'
import { SearchSuggestions } from './SearchSuggestions'
import type {
  UnifiedSearchConfig,
  UnifiedChip,
  MultiSelectOption,
} from '@/types/unified-search'

interface UnifiedSearchBarProps {
  config: UnifiedSearchConfig
  chips: UnifiedChip[]
  isFiltered: boolean
  inputValue: string
  onInputChange: (val: string) => void
  onApply: (param: string, value: string) => Promise<void>
  onRemove: (param: string) => Promise<void>
  onClearAll: () => Promise<void>
  groupBy: string | null
  onGroupBySelect: (key: string | null) => Promise<void>
  paramValues: Record<string, string | null>
  filterOptions?: Record<string, MultiSelectOption[]>
  placeholder?: string
  className?: string
  prefix?: React.ReactNode
  viewOptions?: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]
  currentView?: string
  onViewChange?: (view: string) => void
  toolbarActions?: React.ReactNode
}

function formatChipLabel(chip: UnifiedChip): string {
  if (chip.variant === 'group') return `Agrupado por ${chip.valueLabel}`
  if (chip.variant === 'search') return chip.valueLabel
  return `${chip.label}: ${chip.valueLabel}`
}

export function UnifiedSearchBar({
  config,
  chips,
  inputValue,
  onInputChange,
  onApply,
  onRemove,
  groupBy,
  onGroupBySelect,
  paramValues,
  filterOptions,
  placeholder = 'Buscar...',
  className,
  prefix,
  viewOptions,
  currentView,
  onViewChange,
  toolbarActions,
}: UnifiedSearchBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [forceFilters, setForceFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [triggerWidth, setTriggerWidth] = useState(0)

  useEffect(() => {
    if (containerRef.current) {
      setTriggerWidth(containerRef.current.offsetWidth)
    }
  }, [])

  const handleBarClick = useCallback(() => {
    setForceFilters(false)
    setMenuOpen(true)
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
        const lastChip = chips[chips.length - 1]
        lastChip.onRemove()
        return
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
        inputRef.current?.blur()
      }
      if (e.key === 'Enter' && inputValue.trim()) {
        onApply('search', inputValue.trim())
        onInputChange('')
        setMenuOpen(false)
      }
    },
    [inputValue, chips, onApply, onInputChange],
  )

  const handleSuggestionSelect = useCallback(
    async (param: string, value: string) => {
      await onApply(param, value)
      onInputChange('')
    },
    [onApply, onInputChange],
  )

  const handleClose = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const hasSearchText = inputValue.trim().length > 0

  return (
    <div className={cn("flex items-center w-full", className)} role="search" aria-label="Búsqueda y filtros">
      <Popover open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) setForceFilters(false) }}>
        <PopoverTrigger asChild>
          <div className="flex items-center w-full">
            <div
              ref={containerRef}
              onClick={handleBarClick}
              className={cn(
                "flex items-center flex-1 h-9 rounded-sm border border-border/40 bg-background px-2.5 gap-1.5",
                "cursor-pointer transition-colors",
                "hover:border-border/60",
                "focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15",
              )}
            >
              {prefix}

              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />

              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                {chips.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {chips.map((chip) => (
                      <span
                        key={chip.id}
                        className={cn(
                          "inline-flex items-center gap-1 h-5 px-2 rounded-full text-2xs font-medium whitespace-nowrap shrink-0 max-w-[180px]",
                          chip.variant === 'search' && "bg-muted text-muted-foreground",
                          chip.variant === 'filter' && "bg-primary/10 text-primary",
                          chip.variant === 'date' && "bg-info/10 text-info",
                          chip.variant === 'range' && "bg-warning/10 text-warning",
                          chip.variant === 'group' && "bg-pantone-violet/10 text-pantone-violet",
                        )}
                      >
                        <span className="truncate">{formatChipLabel(chip)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${formatChipLabel(chip)}`}
                          onClick={(e) => { e.stopPropagation(); chip.onRemove() }}
                          className="size-4 shrink-0 rounded-full p-0 hover:bg-foreground/10"
                        >
                          <X className="size-2.5" aria-hidden />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => { setForceFilters(false); onInputChange(e.target.value) }}
                  onKeyDown={handleKeyDown}
                  placeholder={chips.length === 0 ? placeholder : ''}
                  aria-label={placeholder}
                  className="flex-1 h-full min-w-[80px] border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setForceFilters(true); setMenuOpen(prev => !prev) }}
                aria-label="Abrir filtros y búsqueda"
                aria-expanded={menuOpen}
                className={cn(
                  "relative size-8 shrink-0 cursor-pointer rounded-none rounded-r-sm outline-none transition-colors",
                  "hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  "before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-border/40",
                )}
              >
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                    menuOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </Button>
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          style={{ width: triggerWidth > 0 ? triggerWidth : undefined }}
          className="p-0 border-border/80 shadow-floating"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {hasSearchText && !forceFilters ? (
            <SearchSuggestions
              inputValue={inputValue}
              searchFields={config.searchFields}
              onSelect={handleSuggestionSelect}
              onClose={handleClose}
            />
          ) : (
            <SearchBarMenu
              filters={config.filters}
              dateFilters={config.dateFilters}
              groupBy={config.groupBy}
              paramValues={paramValues}
              currentGroupBy={groupBy}
              filterOptions={filterOptions}
              onApply={onApply}
              onRemove={onRemove}
              onGroupBySelect={onGroupBySelect}
              viewOptions={viewOptions}
              currentView={currentView}
              onViewChange={onViewChange}
            />
          )}
        </PopoverContent>
      </Popover>

      {toolbarActions && (
        <div className="flex shrink-0 ml-2">
          {toolbarActions}
        </div>
      )}
    </div>
  )
}
