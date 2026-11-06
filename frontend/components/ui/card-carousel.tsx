"use client"

import React, { useState, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CardCarouselProps {
    children: React.ReactNode
}

/**
 * Shows one child at a time with animated slide transitions, prev/next buttons
 * (visible on hover) and dot indicators below. With a single child, renders it directly.
 */
export function CardCarousel({ children }: CardCarouselProps) {
    const items = React.Children.toArray(children)
    const [current, setCurrent] = useState(0)
    const [direction, setDirection] = useState<"forward" | "backward">("forward")

    const goTo = useCallback(
        (idx: number) => {
            setDirection(idx >= current ? "forward" : "backward")
            setCurrent(idx)
        },
        [current],
    )

    if (items.length === 0) return null
    if (items.length === 1) return <>{items[0]}</>

    const animClass =
        direction === "forward"
            ? "[animation:carousel-slide-in-right_200ms_ease-out]"
            : "[animation:carousel-slide-in-left_200ms_ease-out]"

    return (
        <div className="space-y-2">
            {/* Card stage */}
            <div className="relative group/carousel overflow-hidden rounded-sm">
                <div key={current} className={animClass}>
                    {items[current]}
                </div>

                {current > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => goTo(current - 1)}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        aria-label="Anterior"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                )}

                {current < items.length - 1 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => goTo(current + 1)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        aria-label="Siguiente"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {/* Dot indicators */}
            <div className="flex gap-1.5 justify-center" role="tablist" aria-label="Elementos del carrusel">
                {items.map((_, i) => (
                    <Button
                        key={i}
                        type="button"
                        variant="ghost"
                        onClick={() => goTo(i)}
                        role="tab"
                        aria-selected={i === current}
                        aria-label={`Elemento ${i + 1} de ${items.length}`}
                        className={`rounded-full transition-all duration-200 p-0 min-w-0 ${
                            i === current
                                ? "w-4 h-4 bg-primary hover:bg-primary"
                                : "w-4 h-4 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}
