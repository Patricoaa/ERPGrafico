"use client"

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    const [activeSubTab, setActiveSubTab] = useState('unbilled')
    const [selectedCardAccount, setSelectedCardAccount] = useState<number | null>(
        creditCardAccounts[0]?.id ?? null
    )

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

    const currentAccount = creditCardAccounts.find(a => a.id === selectedCardAccount)

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Toolbar row — sub-tab tabs + TC selector */}
            <div className="flex items-center gap-3 shrink-0">
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                    <TabsList className="h-8">
                        <TabsTrigger value="unbilled" className="text-xs px-3">
                            Cargos No Facturados
                        </TabsTrigger>
                        <TabsTrigger value="statements" className="text-xs px-3">
                            Cargos Facturados
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {creditCardAccounts.length > 1 ? (
                    <Tabs
                        value={String(selectedCardAccount)}
                        onValueChange={(v) => setSelectedCardAccount(Number(v))}
                    >
                        <TabsList className="h-8">
                            {creditCardAccounts.map(acc => (
                                <TabsTrigger key={acc.id} value={String(acc.id)} className="text-xs px-2">
                                    {acc.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                        {creditCardAccounts[0]?.name}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 mt-4 flex flex-col">
                {activeSubTab === 'unbilled' && selectedCardAccount && (
                    <UnbilledChargesView
                        bankId={bankId}
                        cardAccountId={selectedCardAccount}
                        cardAccountName={currentAccount?.name || ''}
                        currency={currentAccount?.currency || 'CLP'}
                    />
                )}
                {activeSubTab === 'statements' && (
                    <StatementsView bankId={bankId} cardAccountId={selectedCardAccount} />
                )}
            </div>
        </div>
    )
}
