'use client'

import { useRef, useState, useCallback, useEffect, KeyboardEvent, useMemo } from 'react'
import { Search, X, ChevronRight, ChevronLeft, CornerDownLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import type { SearchDefinition, FieldDef, EnumFieldDef, DateRangeFieldDef, TextFieldDef } from '@/types/search'
import { useSmartSearch } from './useSmartSearch'
import { useSuggestions } from '@/hooks/useSuggestions'
import { Chip } from '@/components/shared'

interface SmartSearchBarProps {
  searchDef: SearchDefinition
  placeholder?: string
  className?: string
}

type DropdownStage =
  | { type: 'fields' }
  | { type: 'enum-options'; field: EnumFieldDef }
  | { type: 'daterange'; field: DateRangeFieldDef }
  | { type: 'closed' }

function hasSubcategories(field: FieldDef): boolean {
  if (field.type === 'enum') return true
  if (field.type === 'daterange') return true
  return false
}

export function SmartSearchBar({ searchDef, placeholder = 'Buscar...', className }: SmartSearchBarProps) {
  const { filters, chips, inputValue, setInputValue, applyFilter, removeFilter, clearAll } = useSmartSearch(searchDef)

  const [stage, setStage] = useState<DropdownStage>({ type: 'closed' })
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const parsedActiveFieldInfo = useMemo(() => {
    const trimmedInput = inputValue.trim()
    const colonIndex = trimmedInput.indexOf(':')
    if (colonIndex === -1) return null

    const prefix = trimmedInput.slice(0, colonIndex).trim().toLowerCase()
    const value = trimmedInput.slice(colonIndex + 1).trim()

    const matchedField = searchDef.fields.find(
      (f) =>
        f.label.toLowerCase() === prefix ||
        f.key.toLowerCase() === prefix ||
        (f.type === 'text' && f.serverParam.toLowerCase() === prefix)
    )

    if (matchedField && matchedField.type === 'text') {
      return { field: matchedField, value }
    }
    return null
  }, [inputValue, searchDef.fields])

  const activeSuggestionsUrl = parsedActiveFieldInfo?.field.suggestionsUrl
  const suggestionQuery = parsedActiveFieldInfo?.value ?? ''
  const { suggestions, isLoading: isSuggestionsLoading } = useSuggestions(activeSuggestionsUrl, suggestionQuery)

  const isOpen = stage.type !== 'closed' || !!activeSuggestionsUrl

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
      setFocusedIndex(-1)
      if (hasSubcategories(field)) {
        setInputValue('')
        if (field.type === 'enum') {
          setStage({ type: 'enum-options', field })
        } else if (field.type === 'daterange') {
          setStage({ type: 'daterange', field })
          setDateRange(undefined)
        }
      } else {
        // Simple text filter: Prefill the exact label as a prefix in the main input
        setInputValue(`${field.label}: `)
        setStage({ type: 'closed' })
        setFocusedIndex(-1)
        // Focus the main input after a short delay
        setTimeout(() => inputRef.current?.focus(), 0)
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

  const handleTextSubmit = useCallback(async () => {
    // If we are in the main input
    const trimmedInput = inputValue.trim()
    if (!trimmedInput) return

    const colonIndex = trimmedInput.indexOf(':')
    if (colonIndex !== -1) {
      const prefix = trimmedInput.slice(0, colonIndex).trim().toLowerCase()
      const value = trimmedInput.slice(colonIndex + 1).trim()

      // Find if the prefix matches any field's label or key
      const matchedField = searchDef.fields.find(
        (f) =>
          f.label.toLowerCase() === prefix ||
          f.key.toLowerCase() === prefix ||
          (f.type === 'text' && f.serverParam.toLowerCase() === prefix)
      )

      if (matchedField) {
        if (value && matchedField.type !== 'daterange') {
          await applyFilter(matchedField.serverParam, value)
          setInputValue('')
          close()
        }
        return
      }
    }

    // Fallback to Global Search (search query parameter)
    await applyFilter('search', trimmedInput)
    setInputValue('')
    close()
  }, [inputValue, searchDef.fields, applyFilter, close, setInputValue])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') { close(); return }

      const currentVal = inputValue

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
        if (activeSuggestionsUrl && focusedIndex >= 0 && suggestions[focusedIndex]) {
          e.preventDefault()
          handleSuggestionSelect(parsedActiveFieldInfo!.field, suggestions[focusedIndex])
          return
        }
        if (stage.type === 'closed' || stage.type === 'fields' || activeSuggestionsUrl) {
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
            : activeSuggestionsUrl
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
    [inputValue, chips, stage, filteredFields, focusedIndex, suggestions, activeSuggestionsUrl, parsedActiveFieldInfo, close, removeFilter, handleFieldSelect, handleEnumSelect, handleSuggestionSelect, handleTextSubmit, handleBack],
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
  const showEnterHint =
    (stage.type === 'closed' || stage.type === 'fields' || !!activeSuggestionsUrl) &&
    inputValue.trim().length > 0 &&
    focusedIndex < 0

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-1.5 h-9 px-2 py-1 rounded-lg overflow-x-auto scrollbar-hide',
          'bg-muted/30 border border-border transition-all',
          'hover:bg-muted/50 hover:ring-2 hover:ring-primary/10',
          'focus-within:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/20',
          isOpen && 'bg-muted/50 border-border rounded-b-none ring-2 ring-primary/20',
        )}
        onClick={() => {
          inputRef.current?.focus()
          const hasColon = inputValue.includes(':')
          if (stage.type === 'closed' && !hasColon && !inputValue.trim()) {
            openFieldList()
          }
        }}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

        {/* Active chips */}
        {chips.map((chip) => (
          <Chip
            key={chip.key}
            intent={chip.isGlobalSearch ? 'neutral' : 'primary'}
            size="xs"
            className="shrink-0"
          >
            <span className="flex items-center gap-1">
              {!chip.isGlobalSearch && <span className="opacity-60">{chip.label}:</span>}
              <span>{chip.valueLabel}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFilter(chip.key) }}
                className={cn(
                  'rounded-full p-0.5 transition-colors ml-0.5 -mr-1 flex items-center justify-center shrink-0',
                  chip.isGlobalSearch ? 'hover:bg-foreground/10' : 'hover:bg-primary/20',
                )}
                aria-label={`Eliminar filtro ${chip.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          </Chip>
        ))}



        {/* Text input */}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value
            setInputValue(val)
            setFocusedIndex(-1)

            const hasColon = val.includes(':')

            if (stage.type !== 'closed' && stage.type !== 'fields') {
              setStage({ type: 'fields' })
            } else if (stage.type === 'closed' && !hasColon) {
              openFieldList()
            } else if (stage.type === 'fields' && hasColon) {
              setStage({ type: 'closed' })
              setFocusedIndex(-1)
            }
          }}
          onFocus={() => {
            const hasColon = inputValue.includes(':')
            if (stage.type === 'closed' && !hasColon && !inputValue.trim()) {
              openFieldList()
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={hasActiveFilters ? '' : placeholder}
          className="flex-1 h-7 min-w-[80px] bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 py-0"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={isOpen && focusedIndex >= 0 ? `ssb-option-${focusedIndex}` : undefined}
        />

        {/* Enter hint — visible when actively typing a text filter */}
        {showEnterHint && (
          <span className="inline-flex items-center text-[8px] text-muted-foreground/40 shrink-0 select-none">
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
                inputValue.trim() ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleTextSubmit()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground truncate">
                        Buscar <span className="font-bold">«{inputValue.trim()}»</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground/60">Búsqueda general en todos los campos</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/50 uppercase tracking-widest shrink-0">
                      Enter
                      <CornerDownLeft className="h-2.5 w-2.5" />
                    </span>
                  </button>
                ) : (
                  <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-widest">Sin coincidencias</p>
                )
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
                    {hasSubcategories(field) && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Stage: enum options */}
          {stage.type === 'enum-options' && (
            <div className="py-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleBack() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-muted/40 transition-colors group text-left"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold group-hover:text-foreground transition-colors">
                  {stage.field.label}
                </span>
              </button>
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

          {/* Dynamic Suggestions for Text Field under Main Input */}
          {activeSuggestionsUrl && (
            <div className="py-1 border-t border-border/30">
              {suggestionQuery.length < 2 ? (
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
                      onClick={() => handleSuggestionSelect(parsedActiveFieldInfo!.field, value)}
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

          {/* Stage: daterange picker */}
          {stage.type === 'daterange' && (
            <div className="p-3 flex flex-col gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleBack() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-muted/40 transition-colors group text-left -mt-1 -ml-1 mb-1 rounded-t-md"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold group-hover:text-foreground transition-colors">
                  {stage.field.label}
                </span>
              </button>
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
