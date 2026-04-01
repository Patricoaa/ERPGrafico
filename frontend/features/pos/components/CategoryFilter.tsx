"use client"

// CategoryFilter Component
// Horizontal scrolling category badges with navigation

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
                    className="h-7 w-7 absolute left-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
                <Badge
                    variant={selectedCategoryId === null ? "default" : "outline"}
                    className={cn(
                        "cursor-pointer whitespace-nowrap flex items-center",
                        // Larger touch targets
                        isTouchPOS ? "h-10 px-4 text-sm" : "h-7 px-3 text-xs",
                        isTouch && "snap-start"
                    )}
                    onClick={() => onSelectCategory(null)}
                >
                    Todos
                </Badge>
                {categories.map(cat => (
                    <Badge
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? "default" : "outline"}
                        className={cn(
                            "cursor-pointer whitespace-nowrap flex items-center gap-1",
                            isTouchPOS ? "h-10 px-4 text-sm" : "h-7 px-3 text-xs",
                            isTouch && "snap-start"
                        )}
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        {cat.icon && <DynamicIcon name={cat.icon} className={isTouchPOS ? "h-4 w-4" : "h-3 w-3"} />}
                        {cat.name}
                    </Badge>
                ))}
            </div>

            {!isTouch && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w7 absolute right-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={scrollRight}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
