"use client"

import { useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UnderlineTabs, type TabItem, EmptyState } from '@/components/shared'
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
    const router = useRouter()

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        let changed = false
        if (!searchParams.has('card') && creditCardAccounts.length > 0) {
            params.set('card', String(creditCardAccounts[0].id))
            changed = true
        }
        if (changed) {
            router.replace(`?${params.toString()}`, { scroll: false })
        }
    }, [])

    const activeSubTab = searchParams.get('subtab') || 'unbilled'
    const cardParam = searchParams.get('card')
    const selectedCardAccount = cardParam
        ? (creditCardAccounts.some(a => a.id === Number(cardParam))
            ? Number(cardParam)
            : creditCardAccounts[0]?.id ?? null)
        : (creditCardAccounts[0]?.id ?? null)

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
                <UnderlineTabs
                    items={[
                        { value: 'unbilled', label: 'Cargos No Facturados' },
                        { value: 'statements', label: 'Cargos Facturados' },
                    ]}
                    value={activeSubTab}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('subtab', v)
                        router.replace(`?${params.toString()}`, { scroll: false })
                    }}
                    orientation="horizontal"
                    variant="underline"
                    className="w-auto"
                    headerClassName="h-8 px-0 bg-transparent"
                    contentClassName="hidden"
                >
                    <div />
                </UnderlineTabs>

                {creditCardAccounts.length > 1 ? (
                    <UnderlineTabs
                        items={creditCardAccounts.map(acc => ({ value: String(acc.id), label: acc.name }))}
                        value={String(selectedCardAccount)}
                        onValueChange={(v) => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('card', v)
                            router.replace(`?${params.toString()}`, { scroll: false })
                        }}
                        orientation="horizontal"
                        variant="underline"
                        className="w-auto"
                        headerClassName="h-8 px-0 bg-transparent"
                        contentClassName="hidden"
                    >
                        <div />
                    </UnderlineTabs>
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
