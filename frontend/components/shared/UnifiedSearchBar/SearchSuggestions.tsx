'use client'

import { Search } from 'lucide-react'
import type { TextFieldDef } from '@/types/unified-search'

interface SearchSuggestionsProps {
  inputValue: string
  searchFields: TextFieldDef[]
  onSelect: (param: string, value: string) => Promise<void>
  onClose: () => void
}

export function SearchSuggestions({
  inputValue,
  searchFields,
  onSelect,
  onClose,
}: SearchSuggestionsProps) {
  if (!inputValue.trim()) return null

  const handleSelect = async (param: string, value: string) => {
    await onSelect(param, value)
    onClose()
  }

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => handleSelect('search', inputValue.trim())}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-foreground">
          Buscar <span className="font-semibold text-primary">&ldquo;{inputValue.trim()}&rdquo;</span> en{' '}
          <span className="font-medium">General</span>
        </span>
      </button>

      {searchFields.map((field) => (
        <button
          key={field.key}
          type="button"
          onClick={() => handleSelect(field.serverParam, inputValue.trim())}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-left"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground">
            Buscar <span className="font-semibold text-primary">&ldquo;{inputValue.trim()}&rdquo;</span> en{' '}
            <span className="font-medium">{field.label}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
