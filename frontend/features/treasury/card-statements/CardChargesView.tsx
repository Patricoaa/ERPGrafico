"use client"

import { UnbilledChargesClientView } from './UnbilledChargesClientView'
import { StatementsClientView } from './StatementsClientView'

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
                    <UnbilledChargesClientView bankId={bankId} />
                )}
                {activeSubTab === 'statements' && (
                    <StatementsClientView bankId={bankId} />
                )}
            </div>
        </div>
    )
}
