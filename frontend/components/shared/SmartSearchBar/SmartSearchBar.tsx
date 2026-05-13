'use client'

import { useRef, useState, useCallback, useEffect, KeyboardEvent } from 'react'
import { Search, X, ChevronRight, ChevronLeft, Loader2, CornerDownLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
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
  | { type: 'text-input'; field: TextFieldDef }
  | { type: 'closed' }

export function SmartSearchBar({ searchDef, placeholder = 'Buscar...', className }: SmartSearchBarProps) {
  const { filters, chips, inputValue, setInputValue, applyFilter, removeFilter, clearAll } = useSmartSearch(searchDef)

  const [stage, setStage] = useState<DropdownStage>({ type: 'closed' })
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [pendingTextValue, setPendingTextValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isOpen = stage.type !== 'closed'

  const activeSuggestionsUrl = stage.type === 'text-input' ? stage.field.suggestionsUrl : undefined
  const { suggestions, isLoading: isSuggestionsLoading } = useSuggestions(activeSuggestionsUrl, pendingTextValue)

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
    setInputValue('')
  }, [setInputValue])

  const close = useCallback(() => {
    setStage({ type: 'closed' })
    setFocusedIndex(-1)
    setInputValue('')
  }, [setInputValue])

  const handleBack = useCallback(() => {
    setStage({ type: 'fields' })
    setFocusedIndex(0)
    setInputValue('')
    // Focus the main input after a short delay to ensure it's visible
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [setInputValue])

  const handleFieldSelect = useCallback(
    (field: FieldDef) => {
      setInputValue('')
      setFocusedIndex(-1)
      if (field.type === 'enum') {
        setStage({ type: 'enum-options', field })
      } else if (field.type === 'daterange') {
        setStage({ type: 'daterange', field })
        setDateRange(undefined)
      } else {
        setStage({ type: 'text-input', field })
        setPendingTextValue('')
        // Focus the dropdown input after it renders
        setTimeout(() => dropdownInputRef.current?.focus(), 0)
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
      setPendingTextValue('')
      close()
      inputRef.current?.focus()
    },
    [applyFilter, close],
  )

  const handleTextSubmit = useCallback(async () => {
    const trimmed = pendingTextValue.trim()
    if (!trimmed) return
    const activeField = stage.type === 'text-input'
      ? stage.field
      : (searchDef.fields.find((f) => f.type === 'text') as TextFieldDef | undefined)
    if (!activeField) return
    await applyFilter(activeField.serverParam, trimmed)
    setPendingTextValue('')
    close()
  }, [pendingTextValue, stage, searchDef.fields, applyFilter, close])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') { close(); return }

      const currentVal = stage.type === 'text-input' ? pendingTextValue : inputValue

      if (e.key === 'Backspace' && currentVal === '') {
        if (stage.type !== 'fields' && stage.type !== 'closed') {
          handleBack()
          return
        }
        if (chips.length > 0) {
          removeFilter(chips[chips.length - 1].key)
          return
        }
      }

      if (e.key === 'Enter') {
        if (stage.type === 'fields' && focusedIndex >= 0 && filteredFields[focusedIndex]) {
          e.preventDefault()
          handleFieldSelect(filteredFields[focusedIndex])
          return
        }
        if (stage.type === 'enum-options') {
          const opt = stage.field.options[focusedIndex]
          if (opt) { e.preventDefault(); handleEnumSelect(stage.field, opt.value) }
          return
        }
        if (stage.type === 'text-input' && focusedIndex >= 0 && suggestions[focusedIndex]) {
          e.preventDefault()
          handleSuggestionSelect(stage.field, suggestions[focusedIndex])
          return
        }
        if (stage.type === 'text-input') {
          handleTextSubmit()
        } else if (stage.type === 'closed' || stage.type === 'fields') {
          handleTextSubmit()
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const list = stage.type === 'fields'
          ? filteredFields
          : stage.type === 'enum-options'
            ? stage.field.options
            : stage.type === 'text-input'
              ? suggestions
              : []
        setFocusedIndex((i) => Math.min(i + 1, list.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, -1))
      }
    },
    [inputValue, pendingTextValue, chips, stage, filteredFields, focusedIndex, suggestions, close, removeFilter, handleFieldSelect, handleEnumSelect, handleSuggestionSelect, handleTextSubmit, handleBack],
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
  const showEnterHint = stage.type === 'text-input' && inputValue.trim().length > 0 && focusedIndex < 0

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-1.5 flex-wrap min-h-9 px-3 rounded-md',
          'bg-muted/20 border border-border/40 transition-all',
          'focus-within:bg-background focus-within:border-border',
          isOpen && 'bg-background border-border rounded-b-none',
        )}
        onClick={() => {
          if (stage.type === 'text-input') {
            dropdownInputRef.current?.focus()
          } else {
            inputRef.current?.focus()
          }
        }}
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
            setFocusedIndex(-1)
            // If in a sub-stage, typing in the main bar should go back to field selection
            if (stage.type !== 'closed' && stage.type !== 'fields') {
              setStage({ type: 'fields' })
            } else if (stage.type === 'closed') {
              openFieldList()
            }
          }}
          onFocus={() => { if (stage.type === 'closed') openFieldList() }}
          onKeyDown={handleKeyDown}
          placeholder={hasActiveFilters ? '' : placeholder}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-[11px] uppercase font-bold tracking-widest placeholder:text-muted-foreground/40 py-1.5"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={isOpen && focusedIndex >= 0 ? `ssb-option-${focusedIndex}` : undefined}
        />

        {/* Enter hint — visible when actively typing a text filter */}
        {showEnterHint && (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/40 shrink-0 select-none">
            <CornerDownLeft className="h-2.5 w-2.5" />
          </span>
        )}

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
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleBack() }}
                  className="p-1 -ml-1 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  {stage.field.label}
                </span>
              </div>
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

          {/* Stage: text input — universal for all text fields */}
          {stage.type === 'text-input' && (
            <div>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleBack() }}
                  className="p-1 -ml-1 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  {stage.field.label}
                </span>
                {isSuggestionsLoading && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground/50 ml-auto" />}
              </div>

              {/* Real input in dropdown */}
              <div className="px-3 pt-3 pb-2">
                <div
                  className={cn(
                    'flex items-center h-9 px-3 rounded-md border transition-all',
                    'bg-background border-border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary',
                  )}
                >
                  <input
                    ref={dropdownInputRef}
                    value={pendingTextValue}
                    onChange={(e) => {
                      setPendingTextValue(e.target.value)
                      setFocusedIndex(-1)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe el valor..."
                    className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold tracking-widest uppercase placeholder:text-muted-foreground/30 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
                  />
                  {pendingTextValue && (
                    <span className="flex items-center gap-0.5 text-[9px] text-primary/50 shrink-0 ml-2 animate-in fade-in slide-in-from-right-1">
                      <CornerDownLeft className="h-2.5 w-2.5" />
                      <span className="font-bold uppercase tracking-widest">Enter</span>
                    </span>
                  )}
                </div>

                {/* Apply button — only when there's a value */}
                {pendingTextValue.trim() && (
                  <button
                    type="button"
                    onClick={() => handleTextSubmit()}
                    className={cn(
                      'mt-2 w-full flex items-center justify-center gap-1.5 h-7 rounded-md',
                      'bg-primary text-primary-foreground',
                      'text-[10px] font-bold uppercase tracking-widest',
                      'transition-opacity hover:opacity-90',
                    )}
                  >
                    <CornerDownLeft className="h-3 w-3" />
                    Aplicar «{pendingTextValue.trim()}»
                  </button>
                )}
              </div>

              {/* Suggestions — only when suggestionsUrl is configured */}
              {stage.field.suggestionsUrl && (
                <div className="border-t border-border/30">
                  {pendingTextValue.length < 2 ? (
                    <p className="px-3 py-2 text-[10px] text-muted-foreground/60">Escribe 2 o más caracteres para ver sugerencias</p>
                  ) : isSuggestionsLoading ? (
                    <p className="px-3 py-2 text-[10px] text-muted-foreground/60">Buscando...</p>
                  ) : suggestions.length === 0 ? (
                    <p className="px-3 py-2 text-[10px] text-muted-foreground/60">Sin coincidencias</p>
                  ) : (
                    <div className="py-1">
                      {suggestions.map((value, i) => (
                        <button
                          key={value}
                          id={`ssb-option-${i}`}
                          type="button"
                          role="option"
                          aria-selected={i === focusedIndex}
                          onClick={() => handleSuggestionSelect(stage.field, value)}
                          className={cn(
                            'w-full flex items-center px-3 py-1.5 text-left transition-colors',
                            'text-[11px] font-medium',
                            i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-foreground',
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stage: daterange picker */}
          {stage.type === 'daterange' && (
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 -mt-1 -ml-1 mb-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleBack() }}
                  className="p-1 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  {stage.field.label}
                </span>
              </div>
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
