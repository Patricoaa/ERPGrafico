"use client"

import { useState, useMemo, useCallback } from "react"
import { Check, Tag, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

import { LabeledContainer, SearchablePopover } from "@/components/shared"
import { type ProductCategory } from "@/types/entities"
import { useCategories } from "@/features/inventory/hooks/useCategories"
import { CategoryDrawer } from "@/features/inventory/components/CategoryDrawer"

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
    placeholder = "",
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

    const { categories = [], isLoading } = useCategories()

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

    const handleSelect = useCallback((category: ProductCategory) => {
        onChange(category.id.toString())
        setOpen(false)
        setSearchTerm("")
    }, [onChange])

    const handleCreateSuccess = useCallback((category: ProductCategory) => {
        handleSelect(category)
        setIsCreateModalOpen(false)
    }, [handleSelect])

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
            className={className}
        >
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Buscar categoría..."
                items={filteredCategories}
                isLoading={isLoading}
                selectedId={value && value !== "none" && value !== "__none__" ? value.toString() : null}
                getId={(c) => c.id}
                onSelect={handleSelect}
                renderItem={(cat) => (
                    <>
                        <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                        <span className="font-medium flex-1">{cat.name}</span>
                        {selectedCategory?.id === cat.id && (
                            <Check className="ml-auto h-4 w-4 shrink-0 opacity-100" />
                        )}
                    </>
                )}
                trigger={
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
                                <div className="flex items-center justify-center text-muted-foreground/60 transition-colors shrink-0">
                                    {icon}
                                </div>
                            )}
                            {selectedCategory ? (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {!icon && <Tag className="h-3 w-3 shrink-0 text-primary" />}
                                    <span className="font-bold text-[11px] truncate uppercase tracking-tight text-foreground leading-none">{selectedCategory.name}</span>
                                </div>
                            ) : (
                                <span className="text-[11px] text-muted-foreground opacity-50 truncate leading-none">{placeholder}</span>
                            )}
                        </div>
                        {!disabled && <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-30" />}
                    </Button>
                }
                beforeItems={allowNone ? (
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-sm hover:bg-muted"
                        onClick={() => {
                            onChange(null)
                            setOpen(false)
                            setSearchTerm("")
                        }}
                    >
                        <span className="text-muted-foreground">{noneLabel}</span>
                        {(!value || value === "none" || value === "__none__") && (
                            <Check className="ml-auto h-4 w-4 shrink-0" />
                        )}
                    </Button>
                ) : undefined}
                searchRightAction={showPlusButton ? (
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
                ) : undefined}
            />

            <CategoryDrawer
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={handleCreateSuccess}
            />
        </LabeledContainer>
    )
}
