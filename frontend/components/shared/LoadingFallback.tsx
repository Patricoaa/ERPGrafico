import React from 'react'
import { TableSkeleton } from './TableSkeleton'
import { CardSkeleton } from './CardSkeleton'

interface LoadingFallbackProps {
    className?: string
    /**
     * Loading variant:
     * - 'table': Default ERP table skeleton (default)
     * - 'card': Grid of card skeletons
     * - 'list': List of card skeletons
     *
     * @deprecated 'spinner' variant removed — see GOVERNANCE.md Rule 10
     */
    variant?: 'table' | 'card' | 'list'
    /** Accessible label announced by screen readers. Passed through to the skeleton's aria-label. */
    message?: string
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    className = '',
    variant = 'table',
    message = 'Cargando...',
}) => {
    if (variant === 'card' || variant === 'list') {
        const skeletonVariant = variant === 'card' ? 'grid' : 'list'
        return (
            <CardSkeleton
                className={className}
                variant={skeletonVariant}
                ariaLabel={message}
            />
        )
    }

    return <TableSkeleton className={className} ariaLabel={message} />
}
