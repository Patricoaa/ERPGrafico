"use client"

import { Skeleton } from '@/components/shared'
import { useAllBanksOverview } from '../hooks/useAllBanksOverview'

export function BankCenterAllView() {
    const { overviews, isLoading } = useAllBanksOverview()

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
        )
    }

    return null
}
