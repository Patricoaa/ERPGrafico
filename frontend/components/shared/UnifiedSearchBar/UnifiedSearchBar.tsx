'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { SearchBarMenu } from './SearchBarMenu'
import { SearchSuggestions } from './SearchSuggestions'
import type {
  UnifiedSearchConfig,
  UnifiedChip,
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
  placeholder?: string
  className?: string
}

function formatChipLabel(chip: UnifiedChip): string {
  if (chip.variant === 'group') return `Agrupado por ${chip.valueLabel}`
  if (chip.variant === 'search') return chip.valueLabel
  return `${chip.label}: ${chip.valueLabel}`
}

export function UnifiedSearchBar({
  config,
  chips,
  isFiltered,
  inputValue,
  onInputChange,
  onApply,
  onRemove,
  onClearAll,
  groupBy,
  onGroupBySelect,
  paramValues,
  placeholder = 'Buscar...',
  className,
}: UnifiedSearchBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [triggerWidth, setTriggerWidth] = useState(0)

  useEffect(() => {
    if (containerRef.current) {
      setTriggerWidth(containerRef.current.offsetWidth)
    }
  }, [])

  const handleBarClick = useCallback(() => {
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

  const handleClose = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const hasSearchText = inputValue.trim().length > 0

  return (
    <div className={cn("flex items-center w-full", className)}>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <div
            ref={containerRef}
            onClick={handleBarClick}
            className={cn(
              "flex items-center flex-1 h-9 bg-background border border-border/60 rounded-sm px-2 gap-1",
              "focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all",
              "cursor-pointer",
            )}
          >
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
                        chip.variant === 'date' && "bg-blue-500/10 text-blue-600",
                        chip.variant === 'range' && "bg-amber-500/10 text-amber-600",
                        chip.variant === 'group' && "bg-purple-500/10 text-purple-600",
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
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chips.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60 h-full"
              />
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded-sm shrink-0",
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
          {hasSearchText ? (
            <SearchSuggestions
              inputValue={inputValue}
              searchFields={config.searchFields}
              onSelect={onApply}
              onClose={handleClose}
            />
          ) : (
            <SearchBarMenu
              filters={config.filters}
              dateFilters={config.dateFilters}
              groupBy={config.groupBy}
              paramValues={paramValues}
              currentGroupBy={groupBy}
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
