'use client'

import { useRef, useState, useCallback, useEffect, type KeyboardEvent, useMemo } from 'react'
import { Search, X, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchDefinition, FieldDef, TextFieldDef } from '@/types/search'
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
  | { type: 'closed' }

function isTextField(field: FieldDef): field is TextFieldDef {
  return field.type === 'text'
}

export function SmartSearchBar({ searchDef, placeholder = 'Buscar...', className }: SmartSearchBarProps) {
  const { filters, chips, inputValue, setInputValue, applyFilter, removeFilter, clearAll } = useSmartSearch(searchDef)

  const [stage, setStage] = useState<DropdownStage>({ type: 'closed' })
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const parsedActiveFieldInfo = useMemo(() => {
    const trimmedInput = inputValue.trim()
    const colonIndex = trimmedInput.indexOf(':')
    if (colonIndex === -1) return null

    const prefix = trimmedInput.slice(0, colonIndex).trim().toLowerCase()
    const value = trimmedInput.slice(colonIndex + 1).trim()

    const matchedField = searchDef.fields.find(
      (f): f is TextFieldDef =>
        isTextField(f) && (
          f.label.toLowerCase() === prefix ||
          f.key.toLowerCase() === prefix ||
          f.serverParam.toLowerCase() === prefix
        )
    )

    if (matchedField) {
      return { field: matchedField, value }
    }
    return null
  }, [inputValue, searchDef.fields])

  const activeSuggestionsUrl = parsedActiveFieldInfo?.field.suggestionsUrl
  const suggestionQuery = parsedActiveFieldInfo?.value ?? ''
  const { suggestions, isLoading: isSuggestionsLoading } = useSuggestions(activeSuggestionsUrl, suggestionQuery)

  const isOpen = stage.type !== 'closed' || !!activeSuggestionsUrl

  const filteredFields: TextFieldDef[] = inputValue.trim()
    ? searchDef.fields.filter((f): f is TextFieldDef => f.label.toLowerCase().includes(inputValue.toLowerCase()) && isTextField(f))
    : searchDef.fields.filter(isTextField)

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

  const handleFieldSelect = useCallback(
    (field: TextFieldDef) => {
      setFocusedIndex(-1)
      setInputValue(`${field.label}: `)
      setStage({ type: 'closed' })
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    [setInputValue],
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
    const trimmedInput = inputValue.trim()
    if (!trimmedInput) return

    const colonIndex = trimmedInput.indexOf(':')
    if (colonIndex !== -1) {
      const prefix = trimmedInput.slice(0, colonIndex).trim().toLowerCase()
      const value = trimmedInput.slice(colonIndex + 1).trim()

      const matchedField = searchDef.fields.find(
        (f): f is TextFieldDef =>
          isTextField(f) && (
            f.label.toLowerCase() === prefix ||
            f.key.toLowerCase() === prefix ||
            f.serverParam.toLowerCase() === prefix
          )
      )

      if (matchedField && value) {
        await applyFilter(matchedField.serverParam, value)
        setInputValue('')
        close()
        return
      }
    }

    await applyFilter('search', trimmedInput)
    setInputValue('')
    close()
  }, [inputValue, searchDef.fields, applyFilter, close, setInputValue])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') { close(); return }

      const currentVal = inputValue

      if (e.key === 'Backspace' && currentVal === '') {
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
    [inputValue, chips, stage, filteredFields, focusedIndex, suggestions, activeSuggestionsUrl, parsedActiveFieldInfo, close, removeFilter, handleFieldSelect, handleSuggestionSelect, handleTextSubmit],
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
      <div
        className={cn(
          'group flex items-center gap-1.5 h-9 px-2 py-1 rounded-sm overflow-x-auto scrollbar-hide',
          'bg-background transition-all',
          'hover:bg-muted/50 hover:text-foreground',
          'focus-within:bg-muted/50',
          isOpen && 'bg-muted/50 ring-2 ring-primary/20',
        )}
        onClick={() => {
          inputRef.current?.focus()
          const hasColon = inputValue.includes(':')
          if (stage.type === 'closed' && !hasColon && !inputValue.trim()) {
            openFieldList()
          }
        }}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-colors group-hover:text-foreground" />

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
                className="rounded-full p-0.5 ml-0.5 -mr-1 flex items-center justify-center shrink-0"
                aria-label={`Eliminar filtro ${chip.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          </Chip>
        ))}

        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value
            setInputValue(val)
            setFocusedIndex(-1)

            const hasColon = val.includes(':')

            if (stage.type === 'closed' && !hasColon) {
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
          className="flex-1 h-7 min-w-[80px] bg-transparent border-none outline-none text-[9px] font-black text-muted-foreground placeholder:text-muted-foreground/40 py-0"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={isOpen && focusedIndex >= 0 ? `ssb-option-${focusedIndex}` : undefined}
        />

        {showEnterHint && (
          <span className="inline-flex items-center text-[9px] font-black text-muted-foreground/40 shrink-0 select-none">
            <CornerDownLeft className="h-2.5 w-2.5" />
          </span>
        )}

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
            'absolute z-50 left-0 right-0 mt-1',
            'bg-popover/95 backdrop-blur-md rounded-sm shadow-floating',
            'overflow-hidden',
          )}
          role="listbox"
        >
          {/* Stage: field list */}
          {stage.type === 'fields' && (
            <div className="p-1">
              {filteredFields.length === 0 ? (
                inputValue.trim() ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleTextSubmit()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-primary/5 rounded-sm"
                  >
                    <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-foreground truncate">
                        Buscar <span className="font-black">«{inputValue.trim()}»</span>
                      </p>
                      <p className="text-[9px] font-black text-muted-foreground/60">Búsqueda general en todos los campos</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest shrink-0">
                      Enter
                      <CornerDownLeft className="h-2.5 w-2.5" />
                    </span>
                  </button>
                ) : (
                  <p className="px-3 py-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Sin coincidencias</p>
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
                      'w-full flex items-center justify-between px-2.5 py-2 text-left transition-colors rounded-sm',
                      'text-[9px] font-black uppercase tracking-widest',
                      i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 text-foreground',
                    )}
                  >
                    <span>{field.label}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Dynamic Suggestions for Text Field */}
          {activeSuggestionsUrl && (
            <div className="p-1">
              {suggestionQuery.length < 2 ? (
                <p className="px-3 py-2 text-[9px] font-black text-muted-foreground/60">Escribe 2 o más caracteres para ver sugerencias</p>
              ) : isSuggestionsLoading ? (
                <p className="px-3 py-2 text-[9px] font-black text-muted-foreground/60">Buscando...</p>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-2 text-[9px] font-black text-muted-foreground/60">Sin coincidencias</p>
              ) : (
                <div>
                  {suggestions.map((value, i) => (
                    <button
                      key={value}
                      id={`ssb-option-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === focusedIndex}
                      onClick={() => handleSuggestionSelect(parsedActiveFieldInfo!.field, value)}
                      className={cn(
                        'w-full flex items-center px-2.5 py-1.5 text-left transition-colors rounded-sm',
                        'text-[9px] font-black',
                        i === focusedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 text-foreground',
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
    </div>
  )
}


