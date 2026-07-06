"use client"
import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/useDebounce"
import { useUniversalSearch } from "@/features/search"

import { DynamicIcon, LabeledContainer, SearchablePopover } from '@/components/shared'
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import type { SearchResult } from "@/features/search/api/searchApi"

export interface SourceDocument {
    content_type_id: number
    object_id: number
    display: string
    label: string
    icon: string
}

interface SourceDocumentSelectorProps {
    value?: SourceDocument | null
    onChange: (value: SourceDocument | null) => void
    disabled?: boolean
    label?: string
    error?: string
    className?: string
    allowedLabels?: string[]
}

export function SourceDocumentSelector({
    value,
    onChange,
    disabled = false,
    label,
    error,
    className,
    allowedLabels,
}: SourceDocumentSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 300)
    const { results, isLoading } = useUniversalSearch(debouncedSearch)
    const filteredResults = allowedLabels ? results.filter((r) => allowedLabels.includes(r.label)) : results
    const { openEntity } = useGlobalModalActions()

    const handleSelect = (result: SearchResult) => {
        onChange({
            content_type_id: result.content_type_id,
            object_id: result.id,
            display: result.display,
            label: result.label,
            icon: result.icon,
        })
        setOpen(false)
        setSearchTerm("")
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(null)
    }

    return (
        <LabeledContainer
            label={label}
            error={error}
            disabled={disabled}
            className={className}
        >
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Buscar factura, OC, despacho..."
                items={filteredResults}
                isLoading={isLoading}
                selectedId={value ? `${value.label}-${value.object_id}` : null}
                getId={(result) => `${result.label}-${result.id}`}
                onSelect={handleSelect}
                emptyTitle={searchTerm ? "Sin resultados" : "Escriba para buscar"}
                renderItem={(result) => (
                    <div className="flex items-center gap-3 w-full overflow-hidden">
                        <div className="flex-shrink-0 p-2 bg-muted rounded-md">
                            {result.icon && (
                                <DynamicIcon name={result.icon} className="h-4 w-4 text-primary" />
                            )}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1">
                            <div className="flex items-center justify-between">
                                <span className="truncate font-medium">{result.display}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">
                                    {result.title}
                                </span>
                            </div>
                            {result.subtitle && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                    {result.subtitle}
                                </span>
                            )}
                        </div>
                        {value?.content_type_id === result.content_type_id && value?.object_id === result.id && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                    </div>
                )}
                trigger={
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                    >
                        {value ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {value.icon && (
                                    <DynamicIcon name={value.icon} className="h-3.5 w-3.5 shrink-0 text-primary" />
                                )}
                                {hasEntityDrawer(value.label) ? (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); openEntity(value.label, value.object_id, value) }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openEntity(value.label, value.object_id, value) } }}
                                        className="text-sm text-primary underline truncate hover:text-primary/80 cursor-pointer"
                                    >
                                        {value.display || `Documento #${value.object_id}`}
                                    </span>
                                ) : (
                                    <span className="text-sm text-foreground truncate">{value.display || `Documento #${value.object_id}`}</span>
                                )}
                            </div>
                        ) : (
                            <span className="text-muted-foreground truncate">Buscar documento origen...</span>
                        )}
                        <div className="flex items-center gap-1">
                            {value && (
                                <X
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={handleClear}
                                />
                            )}
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </div>
                    </Button>
                }
            />
        </LabeledContainer>
    )
}
