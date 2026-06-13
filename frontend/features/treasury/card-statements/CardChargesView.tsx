"use client"

import { CreditCard } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/shared'
import { UnbilledChargesView } from './UnbilledChargesView'
import { StatementsView } from './StatementsView'

interface CardChargesViewProps {
    bankId: number
    creditCardAccounts: Array<{
        id: number
        name: string
        currency: string
    }>
}

export function CardChargesView({ bankId, creditCardAccounts }: CardChargesViewProps) {
    const searchParams = useSearchParams()
    const activeSubTab = searchParams.get('subtab') || 'unbilled'

    if (creditCardAccounts.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState
                    title="No hay tarjetas de crédito"
                    description="Cree una cuenta de tipo Tarjeta de Crédito."
                    icon={CreditCard}
                />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                {activeSubTab === 'unbilled' && (
                    <UnbilledChargesView
                        creditCardAccounts={creditCardAccounts}
                    />
                )}
                {activeSubTab === 'statements' && (
                    <StatementsView
                        bankId={bankId}
                        creditCardAccounts={creditCardAccounts}
                    />
                )}
            </div>
        </div>
    )
}
