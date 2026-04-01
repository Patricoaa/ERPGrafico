import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingFallbackProps {
    /** Optional message to display below the spinner */
    message?: string
    /** Optional className for custom styling */
    className?: string
}

/**
 * Reusable loading fallback component for Suspense boundaries
 * Used during lazy loading of components and routes
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message,
    className = ''
}) => {
    return (
        <div className={`flex flex-col justify-center items-center h-96 ${className}`}>
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            {message && (
                <p className="mt-4 text-sm text-muted-foreground">{message}</p>
            )}
        </div>
    )
}
