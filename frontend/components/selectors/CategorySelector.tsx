"use client"

import { useState, useMemo } from "react"
import { Check, ChevronDown, Search, Loader2, Tag, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { EmptyState, LabeledContainer } from "@/components/shared"
import { ProductCategory } from "@/types/entities"
import { CATEGORIES_QUERY_KEY } from "@/features/inventory/hooks/useCategories"
import { CategoryForm } from "@/features/inventory/components/CategoryForm"

interface CategorySelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
    required?: boolean
    className?: string
    showPlusButton?: boolean
    excludeId?: number | string
    allowNone?: boolean
    noneLabel?: string
    icon?: React.ReactNode
}

export function CategorySelector({
    value,
    onChange,
    placeholder = "Seleccionar categoría...",
    disabled,
    label,
    error,
    required,
    className,
    showPlusButton = true,
    excludeId,
    allowNone = false,
    noneLabel = "Ninguno",
    icon
}: CategorySelectorProps) {
    const [open, setOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const { data: categories = [], isLoading } = useQuery({
        queryKey: CATEGORIES_QUERY_KEY,
        queryFn: async (): Promise<ProductCategory[]> => {
            const response = await api.get('/inventory/categories/')
            return response.data.results || response.data
        },
    })

    const selectedCategory = useMemo(() => {
        if (!value || value === "none" || value === "__none__") return null
        return categories.find(c => c.id.toString() === value.toString())
    }, [categories, value])

    const filteredCategories = useMemo(() => {
        let result = categories
        if (excludeId) {
            result = result.filter(c => c.id.toString() !== excludeId.toString())
        }
        if (!searchTerm) return result
        const term = searchTerm.toLowerCase()
        return result.filter(c => c.name.toLowerCase().includes(term))
    }, [categories, searchTerm, excludeId])

    const handleSelect = (category: ProductCategory) => {
        onChange(category.id.toString())
        setOpen(false)
        setSearchTerm("")
    }

    const handleCreateSuccess = (category: ProductCategory) => {
        handleSelect(category)
        setIsCreateModalOpen(false)
    }

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
            className={className}
        >
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        role="combobox"
                        className={cn(
                            "w-full justify-between overflow-hidden h-[1.5rem]! min-h-0! py-0 px-2 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent",
                            icon && "pl-1"
                        )}
                        disabled={disabled}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                            {icon && (
                                <div className="flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0">
                                    {icon}
                                </div>
                            )}
                            {selectedCategory ? (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {!icon && <Tag className={cn("h-3 w-3 shrink-0", disabled ? "text-muted-foreground" : "text-primary")} />}
                                    <span className="font-bold text-[11px] truncate uppercase tracking-tight text-foreground leading-none">{selectedCategory.name}</span>
                                </div>
                            ) : (
                                <span className="text-[11px] text-muted-foreground opacity-50 truncate leading-none">{placeholder}</span>
                            )}
                        </div>
                        {!disabled && <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-30" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" sideOffset={4}>
                        <div className="p-2">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex-1 flex items-center px-3 border rounded-md bg-background">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                        placeholder="Buscar categoría..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {showPlusButton && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10 shrink-0 border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                                                    onClick={() => {
                                                        setOpen(false)
                                                        setIsCreateModalOpen(true)
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Nueva categoría</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-1">
                                {isLoading ? (
                                    <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                                ) : (
                                    <>
                                        {allowNone && (
                                            <div
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                    !selectedCategory && "bg-accent"
                                                )}
                                                onClick={() => {
                                                    onChange("none")
                                                    setOpen(false)
                                                }}
                                            >
                                                <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground opacity-20" />
                                                <span className="font-medium text-muted-foreground italic">{noneLabel}</span>
                                                {!selectedCategory && (
                                                    <Check className="ml-auto h-4 w-4 opacity-100" />
                                                )}
                                            </div>
                                        )}
                                        {filteredCategories.length === 0 && !allowNone ? (
                                            <EmptyState context="inventory" variant="compact" title="No se encontraron categorías" />
                                        ) : (
                                            filteredCategories.map((cat) => (
                                                <div
                                                    key={cat.id}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                        selectedCategory?.id === cat.id && "bg-accent"
                                                    )}
                                                    onClick={() => handleSelect(cat)}
                                                >
                                                    <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                                    <span className="font-medium">{cat.name}</span>
                                                    {selectedCategory?.id === cat.id && (
                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            <CategoryForm 
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={handleCreateSuccess}
            />
        </LabeledContainer>
    )
}
