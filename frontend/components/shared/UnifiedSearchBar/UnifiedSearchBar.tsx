'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { SearchSuggestions } from './SearchSuggestions'
import type { UnifiedSearchConfig, UnifiedChip } from '@/types/unified-search'

interface UnifiedSearchBarProps {
  config: UnifiedSearchConfig
  chips: UnifiedChip[]
  inputValue: string
  onInputChange: (val: string) => void
  onApply: (param: string, value: string) => Promise<void>
  placeholder?: string
  className?: string
}

/**
 * Search box of the collection command bar (ADR-0158): free text and field-scoped suggestions. Filters,
 * grouping and the applied-filters row belong to `Collection.Toolbar`; Backspace on an empty box removes
 * the last applied filter.
 */
export function UnifiedSearchBar({
  config,
  chips,
  inputValue,
  onInputChange,
  onApply,
  placeholder = 'Buscar...',
  className,
}: UnifiedSearchBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [triggerWidth, setTriggerWidth] = useState(0)

  useEffect(() => {
    if (containerRef.current) setTriggerWidth(containerRef.current.offsetWidth)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
        chips[chips.length - 1].onRemove()
        return
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
        inputRef.current?.blur()
      }
      if (e.key === 'Enter' && inputValue.trim()) {
        void onApply('search', inputValue.trim())
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

  const hasSearchText = inputValue.trim().length > 0

  return (
    <div className={cn('flex w-full items-center', className)} role="search" aria-label="Búsqueda">
      <Popover open={menuOpen && hasSearchText} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <div
            ref={containerRef}
            onClick={() => { setMenuOpen(true); inputRef.current?.focus() }}
            className={cn(
              'flex h-9 flex-1 cursor-text items-center gap-1.5 rounded-sm border border-border/40 bg-background px-2.5 transition-colors',
              'hover:border-border/60',
              'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15',
            )}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setMenuOpen(true); onInputChange(e.target.value) }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-full min-w-[80px] flex-1 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          style={{ width: triggerWidth > 0 ? triggerWidth : undefined }}
          className="border-border/80 p-0 shadow-floating"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SearchSuggestions
            inputValue={inputValue}
            searchFields={config.searchFields}
            onSelect={handleSuggestionSelect}
            onClose={() => setMenuOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
