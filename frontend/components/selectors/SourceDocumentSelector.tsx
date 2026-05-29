"use client"
import { useState } from "react"
import { Check, ChevronDown, Search, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useDebounce } from "@/hooks/useDebounce"
import { useUniversalSearch } from "@/features/search"
import { EmptyState } from "@/components/shared/EmptyState"
import { DynamicIcon } from "@/components/shared"
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
    className?: string
    allowedLabels?: string[]
}

const ICON_MAP: Record<string, string> = {
    "book-open": "BookOpen",
    "file-badge": "FileBadge",
    "file-text": "FileText",
    "landmark": "Landmark",
    "notebook-pen": "NotebookPen",
    "package": "Package",
    "receipt-text": "ReceiptText",
    "shopping-cart": "ShoppingCart",
    "truck": "Truck",
    "user-check": "UserCheck",
    "users": "Users",
    "wallet": "Wallet",
    "wrench": "Wrench",
}

export function SourceDocumentSelector({
    value,
    onChange,
    disabled = false,
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
        <div className={cn("relative w-full flex flex-col", className)}>
            <fieldset className="notched-field w-full">
                <legend className="px-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                    Documento Origen
                </legend>
                <div className="flex items-center w-full">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                role="combobox"
                                aria-expanded={open}
                                disabled={disabled}
                                className={cn(
                                    "w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent",
                                    disabled && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {value ? (
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        {value.icon && ICON_MAP[value.icon] && (
                                            <DynamicIcon name={ICON_MAP[value.icon]} className="h-3.5 w-3.5 shrink-0 text-primary" />
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
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <div className="p-2">
                                <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                        placeholder="Buscar factura, OC, despacho..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                    {isLoading ? (
                                        <div className="p-4 flex justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        </div>
                                    ) : filteredResults.length === 0 ? (
                                        <EmptyState
                                            context="search"
                                            variant="compact"
                                            title={searchTerm ? "Sin resultados" : "Escriba para buscar"}
                                        />
                                    ) : (
                                        filteredResults.map((result) => (
                                            <div
                                                key={`${result.label}-${result.id}`}
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                    value?.content_type_id === result.content_type_id && value?.object_id === result.id && "bg-accent"
                                                )}
                                                onClick={() => handleSelect(result)}
                                            >
                                                <div className="flex items-center gap-3 w-full overflow-hidden">
                                                    <div className="flex-shrink-0 p-2 bg-muted rounded-md">
                                                        {result.icon && ICON_MAP[result.icon] ? (
                                                            <DynamicIcon name={ICON_MAP[result.icon]} className="h-4 w-4 text-primary" />
                                                        ) : null}
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
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </fieldset>
        </div>
    )
}
