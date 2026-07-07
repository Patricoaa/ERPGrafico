"use client"

import { Button } from "@/components/ui/button"
import { ListFilter } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DynamicIcon } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { ProductCategory } from "@/features/inventory/types"

interface CategoryDropdownProps {
    categories: ProductCategory[]
    selectedCategoryId: number | null
    onSelectCategory: (id: number | null) => void
}

export function CategoryDropdown({ categories, selectedCategoryId, onSelectCategory }: CategoryDropdownProps) {
    const selectedCategory = categories.find(c => c.id === selectedCategoryId)

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    className={cn(
                        "flex items-center gap-1 shrink-0 rounded-md px-1.5 py-1 text-muted-foreground/50 hover:text-foreground transition-colors",
                        selectedCategoryId !== null && "text-primary"
                    )}
                    aria-label="Filtrar por categoría"
                >
                    <ListFilter className="size-3.5" />
                    {selectedCategory && (
                        <span className="hidden md:inline text-[10px] uppercase tracking-widest font-medium">
                            {selectedCategory.name}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[280px] p-2 border-border/80 shadow-floating"
            >
                <div className="space-y-1">
                    <Button
                        onClick={() => onSelectCategory(null)}
                        className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-2 text-left rounded-md transition-colors text-[10px] uppercase tracking-widest",
                            selectedCategoryId === null
                                ? "bg-primary/10 text-primary font-bold"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        Todas las categorías
                    </Button>
                    <div className="max-h-[240px] overflow-y-auto space-y-0.5">
                        {categories.map(cat => (
                            <Button
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-2.5 py-2 text-left rounded-md transition-colors text-xs",
                                    selectedCategoryId === cat.id
                                        ? "bg-primary/10 text-primary font-bold"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                {cat.icon && <DynamicIcon name={cat.icon} className="size-4 shrink-0" />}
                                <span className="truncate">{cat.name}</span>
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
