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
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    className = '',
    variant = 'table'
}) => {
    if (variant === 'card' || variant === 'list') {
        return <CardSkeleton className={className} variant={variant} />
    }

    return <TableSkeleton className={className} />
}
