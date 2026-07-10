'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { SearchBarMenu } from './SearchBarMenu'
import { SearchSuggestions } from './SearchSuggestions'
import { TabBar } from '@/components/shared'
import type { LucideIcon } from 'lucide-react'
import type {
  UnifiedSearchConfig,
  UnifiedChip,
  MultiSelectOption,
  ViewTabsConfig,
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
  suffix?: React.ReactNode
  viewTabs?: ViewTabsConfig
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
  suffix,
  viewTabs,
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
    <div className={cn("flex items-center w-full", className)}>
      <Popover open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) setForceFilters(false) }}>
        <PopoverTrigger asChild>
          <div className="flex items-center w-full">
            <div
              ref={containerRef}
              onClick={handleBarClick}
              className={cn(
                "flex items-center flex-1 h-9 bg-background rounded-l-sm px-2 gap-1",
                "cursor-pointer",
              )}
            >
              {prefix}

              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                {chips.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {chips.map((chip) => (
                      <span
                        key={chip.id}
                        className={cn(
                          "inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[11px] font-medium whitespace-nowrap shrink-0 max-w-[180px]",
                          chip.variant === 'search' && "bg-muted text-muted-foreground",
                          chip.variant === 'filter' && "bg-primary/10 text-primary",
                          chip.variant === 'date' && "bg-info/10 text-info",
                          chip.variant === 'range' && "bg-warning/10 text-warning",
                          chip.variant === 'group' && "bg-pantone-violet/10 text-pantone-violet",
                        )}
                      >
                        <span className="truncate">{formatChipLabel(chip)}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); chip.onRemove() }}
                          className="hover:bg-background/50 rounded-sm p-[1px] shrink-0"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
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
                  className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60 h-full"
                />
              </div>
            </div>

            {viewTabs && viewTabs.items.length > 1 && (
              <div className="flex items-center h-9 bg-background px-1 border-l border-border/40 shrink-0">
                <TabBar
                  value={viewTabs.value}
                  onValueChange={viewTabs.onValueChange}
                  items={viewTabs.items.map(i => ({
                    value: i.value,
                    label: i.label,
                    icon: i.icon as LucideIcon | undefined,
                    badge: i.badge,
                    hasErrors: i.hasErrors,
                    hidden: i.hidden,
                    disabled: i.disabled,
                  }))}
                  className="w-auto"
                >
                  <div className="hidden" />
                </TabBar>
              </div>
            )}

            {suffix && (
              <div className="flex items-center gap-1 h-9 bg-background px-1 border-l border-border/40 shrink-0">
                {suffix}
              </div>
            )}

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setForceFilters(true); setMenuOpen(prev => !prev) }}
              className={cn(
                "h-9 w-7 flex items-center justify-center bg-background rounded-r-sm shrink-0",
                "hover:bg-accent/50 transition-colors",
              )}
            >
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
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
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
