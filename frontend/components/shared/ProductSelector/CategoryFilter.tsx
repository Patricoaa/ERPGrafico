"use client"

// ProductSelector/CategoryFilter
// Horizontal scrolling category pill bar with optional arrow navigation.
// Extracted from @/features/pos/components/CategoryFilter (PR-1: ProductSelector migration).

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DynamicIcon } from '@/components/shared'
import { cn } from '@/lib/utils'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { ProductCategory } from '@/features/inventory'

export interface CategoryFilterProps {
    categories: ProductCategory[]
    selectedCategoryId: number | null
    onSelectCategory: (categoryId: number | null) => void
}

export function CategoryFilter({
    categories,
    selectedCategoryId,
    onSelectCategory
}: CategoryFilterProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const { isTouchPOS, isTouch } = useDeviceContext()

    const scrollLeft = () => {
        scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })
    }

    const scrollRight = () => {
        scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
    }

    return (
        <div className="relative flex items-center group">
            {/* Hide navigation arrows on touch devices — use swipe instead */}
            {!isTouch && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 absolute left-0 z-10 bg-background border shadow-floating rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={scrollLeft}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            )}

            <div
                ref={scrollRef}
                className={cn(
                    "flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth px-12",
                    isTouch && "snap-x snap-mandatory"
                )}
            >
                {/* "All" pill */}
                <Button
                    className={cn(
                        "whitespace-nowrap flex items-center justify-center rounded-md font-bold uppercase tracking-wider transition-all border",
                        isTouchPOS ? "h-10 px-5 text-xs" : "h-8 px-3 text-[10px]",
                        selectedCategoryId === null
                            ? "bg-primary text-primary-foreground border-primary shadow-card"
                            : "bg-background border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/30",
                        isTouch && "snap-start"
                    )}
                    onClick={() => onSelectCategory(null)}
                >
                    Todos
                </Button>

                {categories.map(cat => (
                    <Button
                        key={cat.id}
                        className={cn(
                            "whitespace-nowrap flex items-center justify-center gap-1.5 rounded-md font-bold uppercase tracking-wider transition-all border",
                            isTouchPOS ? "h-10 px-5 text-xs" : "h-8 px-3 text-[10px]",
                            selectedCategoryId === cat.id
                                ? "bg-primary text-primary-foreground border-primary shadow-card"
                                : "bg-background border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/30",
                            isTouch && "snap-start"
                        )}
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        {cat.icon && <DynamicIcon name={cat.icon} className={isTouchPOS ? "h-4 w-4" : "h-3 w-3"} />}
                        {cat.name}
                    </Button>
                ))}
            </div>

            {!isTouch && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 absolute right-0 z-10 bg-background border shadow-floating rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={scrollRight}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
