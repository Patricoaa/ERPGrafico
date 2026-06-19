"use client"

import { UnbilledChargesView } from './UnbilledChargesView'
import { StatementsView } from './StatementsView'

interface CardChargesViewProps {
    bankId: number
    subtab?: string
}

export function CardChargesView({ bankId, subtab }: CardChargesViewProps) {
    const activeSubTab = subtab || 'unbilled'

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                {activeSubTab === 'unbilled' && (
                    <UnbilledChargesView bankId={bankId} />
                )}
                {activeSubTab === 'statements' && (
                    <StatementsView bankId={bankId} />
                )}
            </div>
        </div>
    )
}
