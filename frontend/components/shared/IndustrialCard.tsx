"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CARD_TOKENS } from "@/lib/styles"

interface IndustrialCardProps extends React.ComponentProps<typeof Card> {
    variant?: "standard" | "industrial" | "glass"
}

/**
 * IndustrialCard
 * 
 * A standardized card component that implements the project's "industrial design" aesthetic.
 * Features variants for standard usage, premium industrial top-strip styling, and glassmorphism.
 */
export function IndustrialCard({ 
    variant = "industrial", 
    className, 
    children, 
    ...props 
}: IndustrialCardProps) {
    // Get the base token for the container and the specific variant class
    const variantClass = CARD_TOKENS[variant]
    
    return (
        <Card 
            className={cn(CARD_TOKENS.container, variantClass, className)} 
            {...props}
        >
            {children}
        </Card>
    )
}
