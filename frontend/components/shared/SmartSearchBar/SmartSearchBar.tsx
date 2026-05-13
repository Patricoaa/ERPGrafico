'use client'

import { useRef, useState, useCallback, useEffect, KeyboardEvent } from 'react'
import { Search, X, ChevronRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { SearchDefinition, FieldDef, EnumFieldDef, DateRangeFieldDef, TextFieldDef } from '@/types/search'
import { useSmartSearch } from './useSmartSearch'
import { useSuggestions } from '@/hooks/useSuggestions'

interface SmartSearchBarProps {
  searchDef: SearchDefinition
  placeholder?: string
  className?: string
}

type DropdownStage =
  | { type: 'fields' }
  | { type: 'enum-options'; field: EnumFieldDef }
  | { type: 'daterange'; field: DateRangeFieldDef }
  | { type: 'text-suggestions'; field: TextFieldDef }
  | { type: 'closed' }

export function SmartSearchBar({ searchDef, placeholder = 'Buscar...', className }: SmartSearchBarProps) {
  const { filters, chips, inputValue, setInputValue, applyFilter, removeFilter, clearAll } = useSmartSearch(searchDef)

  const [stage, setStage] = useState<DropdownStage>({ type: 'closed' })
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isOpen = stage.type !== 'closed'

  const activeSuggestionsUrl = stage.type === 'text-suggestions' ? stage.field.suggestionsUrl : undefined
  const { suggestions, isLoading: isSuggestionsLoading } = useSuggestions(activeSuggestionsUrl, inputValue)

  // Fields not yet applied (avoid offering duplicates for non-daterange fields)
  const availableFields = searchDef.fields.filter((f) => {
    if (f.type === 'daterange') return true
    return filters[f.serverParam] === undefined
  })

  const filteredFields = inputValue.trim()
    ? availableFields.filter((f) => f.label.toLowerCase().includes(inputValue.toLowerCase()))
    : availableFields

  const openFieldList = useCallback(() => {
    setStage({ type: 'fields' })
    setFocusedIndex(0)
  }, [])

  const close = useCallback(() => {
    setStage({ type: 'closed' })
    setFocusedIndex(0)
  }, [])

  const handleFieldSelect = useCallback(
    (field: FieldDef) => {
      setInputValue('')
      if (field.type === 'enum') {
        setStage({ type: 'enum-options', field })
        setFocusedIndex(0)
      } else if (field.type === 'daterange') {
        setStage({ type: 'daterange', field })
        setDateRange(undefined)
      } else {
        // text field — enter suggestions stage if endpoint configured, else free-form
        if (field.type === 'text' && field.suggestionsUrl) {
          setStage({ type: 'text-suggestions', field })
        } else {
          setStage({ type: 'closed' })
        }
        inputRef.current?.focus()
      }
    },
    [setInputValue],
  )

  const handleEnumSelect = useCallback(
    async (field: EnumFieldDef, value: string) => {
      await applyFilter(field.serverParam, value)
      setInputValue('')
      close()
      inputRef.current?.focus()
    },
    [applyFilter, close, setInputValue],
  )

  const handleDateConfirm = useCallback(
    async (field: DateRangeFieldDef, range: DateRange | undefined) => {
      if (range?.from) await applyFilter(field.serverParamStart, format(range.from, 'yyyy-MM-dd'))
      if (range?.to) await applyFilter(field.serverParamEnd, format(range.to, 'yyyy-MM-dd'))
      close()
      inputRef.current?.focus()
    },
    [applyFilter, close],
  )

  const handleSuggestionSelect = useCallback(
    async (field: TextFieldDef, value: string) => {
      await applyFilter(field.serverParam, value)
      setInputValue('')
      close()
      inputRef.current?.focus()
    },
    [applyFilter, close, setInputValue],
  )

  // Submit text field on Enter
  const handleTextSubmit = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const textField = searchDef.fields.find((f) => f.type === 'text')
    if (!textField) return
    await applyFilter(textField.serverParam, trimmed)
    setInputValue('')
    close()
  }, [inputValue, searchDef.fields, applyFilter, setInputValue, close])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') { close(); return }

      if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
        removeFilter(chips[chips.length - 1].key)
        return
      }

      if (e.key === 'Enter') {
        if (stage.type === 'fields' && filteredFields[focusedIndex]) {
          e.preventDefault()
          handleFieldSelect(filteredFields[focusedIndex])
          return
        }
        if (stage.type === 'enum-options') {
          const field = stage.field
          const opt = field.options[focusedIndex]
          if (opt) { e.preventDefault(); handleEnumSelect(field, opt.value) }
          return
        }
        if (stage.type === 'text-suggestions' && focusedIndex >= 0 && suggestions[focusedIndex]) {
          e.preventDefault()
          handleSuggestionSelect(stage.field, suggestions[focusedIndex])
          return
        }
        handleTextSubmit()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const list = stage.type === 'fields'
          ? filteredFields
          : stage.type === 'enum-options'
            ? stage.field.options
            : stage.type === 'text-suggestions'
              ? suggestions
              : []
        setFocusedIndex((i) => Math.min(i + 1, list.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
      }
    },
    [inputValue, chips, stage, filteredFields, focusedIndex, suggestions, close, removeFilter, handleFieldSelect, handleEnumSelect, handleSuggestionSelect, handleTextSubmit],
  )

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [close])

  const hasActiveFilters = chips.length > 0

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-2xl', className)}>
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-1.5 flex-wrap min-h-9 px-3 rounded-md',
          'bg-muted/20 border border-border/40 transition-all',
          'focus-within:bg-background focus-within:border-border',
          isOpen && 'bg-background border-border rounded-b-none',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

        {/* Active chips */}
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide shrink-0"
          >
            <span className="text-primary/60">{chip.label}:</span>
            {chip.valueLabel}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeFilter(chip.key) }}
              className="text-primary/50 hover:text-primary transition-colors ml-0.5"
              aria-label={`Eliminar filtro ${chip.label}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {/* Text input */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setFocusedIndex(0)
            if (stage.type === 'closed') openFieldList()
          }}
          onFocus={() => { if (stage.type === 'closed') openFieldList() }}
          onKeyDown={handleKeyDown}
          placeholder={hasActiveFilters ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-[11px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 py-1.5"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={isOpen ? `ssb-option-${focusedIndex}` : undefined}
        />

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearAll() }}
            className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 ml-auto"
            aria-label="Eliminar todos los filtros"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 left-0 right-0 top-full',
            'bg-background border border-border border-t-0 rounded-b-md shadow-xl',
            'overflow-hidden',
          )}
          role="listbox"
        >
          {/* Stage: field list */}
          {stage.type === 'fields' && (
            <div className="py-1">
              {filteredFields.length === 0 ? (
                <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-widest">Sin coincidencias</p>
              ) : (
                filteredFields.map((field, i) => (
                  <button
                    key={field.key}
                    id={`ssb-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === focusedIndex}
                    onClick={() => handleFieldSelect(field)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
                      'text-[11px] font-bold uppercase tracking-widest',
                      i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-foreground',
                    )}
                  >
                    <span>{field.label}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Stage: enum options */}
          {stage.type === 'enum-options' && (
            <div className="py-1">
              <p className="px-3 py-1.5 text-[9px] text-muted-foreground uppercase tracking-widest border-b border-border/40">
                {stage.field.label}
              </p>
              {stage.field.options.map((opt, i) => (
                <button
                  key={opt.value}
                  id={`ssb-option-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === focusedIndex}
                  onClick={() => handleEnumSelect(stage.field, opt.value)}
                  className={cn(
                    'w-full flex items-center px-3 py-2 text-left transition-colors',
                    'text-[11px] font-bold uppercase tracking-widest',
                    i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Stage: text suggestions */}
          {stage.type === 'text-suggestions' && (
            <div className="py-1">
              <p className="px-3 py-1.5 text-[9px] text-muted-foreground uppercase tracking-widest border-b border-border/40 flex items-center gap-1.5">
                {stage.field.label}
                {isSuggestionsLoading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              </p>
              {inputValue.length < 2 ? (
                <p className="px-3 py-2 text-[10px] text-muted-foreground">Escribe 2 o más caracteres...</p>
              ) : suggestions.length === 0 && !isSuggestionsLoading ? (
                <p className="px-3 py-2 text-[10px] text-muted-foreground">Sin sugerencias — pulsa Enter para buscar</p>
              ) : (
                suggestions.map((value, i) => (
                  <button
                    key={value}
                    id={`ssb-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === focusedIndex}
                    onClick={() => handleSuggestionSelect(stage.field, value)}
                    className={cn(
                      'w-full flex items-center px-3 py-2 text-left transition-colors',
                      'text-[11px] font-medium',
                      i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-foreground',
                    )}
                  >
                    {value}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Stage: daterange picker */}
          {stage.type === 'daterange' && (
            <div className="p-3 flex flex-col gap-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                {stage.field.label}
              </p>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={es}
                numberOfMonths={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDateConfirm(stage.field, dateRange)}
                  disabled={!dateRange?.from}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground rounded-md disabled:opacity-40 transition-opacity"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
