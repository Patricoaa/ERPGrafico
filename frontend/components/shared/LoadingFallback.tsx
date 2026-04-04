import React from 'react'
import { Loader2 } from 'lucide-react'
import { TableSkeleton } from './TableSkeleton'
import { CardSkeleton } from './CardSkeleton'
import { cn } from '@/lib/utils'

interface LoadingFallbackProps {
    /** Optional message to display below the spinner */
    message?: string
    /** Optional className for custom styling */
    className?: string
    /** 
     * Loading variant:
     * - 'table': Default ERP table skeleton
     * - 'card': Grid of card skeletons
     * - 'list': List of card skeletons
     * - 'spinner': Legacy classic spinner
     */
    variant?: 'table' | 'card' | 'list' | 'spinner'
}

/**
 * Reusable loading fallback component for Suspense boundaries.
 * Now supports high-fidelity Skeletons for Improved perceived performance.
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message,
    className = '',
    variant = 'table'
}) => {
    if (variant === 'spinner') {
        return (
            <div className={cn("flex flex-col justify-center items-center h-96", className)}>
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                {message && (
                    <p className="mt-4 text-sm text-muted-foreground">{message}</p>
                )}
            </div>
        )
    }

    if (variant === 'card' || variant === 'list') {
        return <CardSkeleton className={className} variant={variant} />
    }

    return <TableSkeleton className={className} />
}
