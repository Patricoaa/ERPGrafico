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
    /** Optional label text — accepted for API compatibility but not rendered */
    message?: string
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    className = '',
    variant = 'table',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    message: _message,
}) => {
    if (variant === 'card' || variant === 'list') {
        const skeletonVariant = variant === 'card' ? 'grid' : 'list';
        return <CardSkeleton className={className} variant={skeletonVariant} />
    }

    return <TableSkeleton className={className} />
}
