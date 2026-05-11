"use client"

// CategoryFilter Component
// Horizontal scrolling category badges with navigation

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { cn } from '@/lib/utils'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { Category } from '@/types/pos'

interface CategoryFilterProps {
    categories: Category[]
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
            {/* Hide navigation arrows on touch devices - use swipe instead */}
            {!isTouch && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 absolute left-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={scrollLeft}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            )}

            <div
                ref={scrollRef}
                className={cn(
                    "flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth",
                    // Enable native swipe scrolling on touch
                    isTouch && "snap-x snap-mandatory"
                )}
            >
                <button
                    className={cn(
                        "whitespace-nowrap flex items-center justify-center rounded-md font-bold uppercase tracking-wider transition-all border",
                        isTouchPOS ? "h-12 px-6 text-xs" : "h-10 px-4 text-[10px]",
                        selectedCategoryId === null
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/30",
                        isTouch && "snap-start"
                    )}
                    onClick={() => onSelectCategory(null)}
                >
                    Todos
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={cn(
                            "whitespace-nowrap flex items-center justify-center gap-1.5 rounded-md font-bold uppercase tracking-wider transition-all border",
                            isTouchPOS ? "h-12 px-6 text-xs" : "h-10 px-4 text-[10px]",
                            selectedCategoryId === cat.id
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/30",
                            isTouch && "snap-start"
                        )}
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        {cat.icon && <DynamicIcon name={cat.icon} className={isTouchPOS ? "h-4 w-4" : "h-3 w-3"} />}
                        {cat.name}
                    </button>
                ))}
            </div>

            {!isTouch && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 absolute right-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={scrollRight}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
