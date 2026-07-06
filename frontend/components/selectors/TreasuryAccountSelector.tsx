"use client"

import { formatCurrency } from "@/lib/money"

import { useState } from "react"
import { Check, Loader2, Banknote, CreditCard, Wallet, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { useTreasuryAccounts, type PaymentContext } from "@/hooks/useTreasuryAccounts"
import { LabeledContainer, SearchablePopover, MoneyDisplay } from '@/components/shared'
import type { TreasuryAccountType } from "@/features/treasury/types"

interface TreasuryAccountSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean

    // Filtering options
    context?: PaymentContext
    terminalId?: number
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER'

    // Legacy filter (optional)
    type?: 'BANK' | 'CASH' | 'CHECKING' | 'CREDIT_CARD'

    /**
     * Restrict to one or more account types. Takes precedence over the legacy
     * `type` prop when both are provided. Use this for new call sites that
     * need types other than the legacy four (e.g. BRIDGE).
     */
    accountTypes?: TreasuryAccountType[]

    // Exclude specific account
    excludeId?: number

    // Restrict to specific account IDs (e.g. accounts belonging to a bank)
    allowedIds?: number[]

    // Optional: Return full account object on select
    onSelect?: (account: any) => void
    label?: string
    error?: string
    required?: boolean
}

function getIcon(accountType: string) {
    switch (accountType) {
        case 'CHECKING': return <Landmark className="h-4 w-4" />
        case 'CASH': return <Wallet className="h-4 w-4" />
        case 'CREDIT_CARD':
        case 'DEBIT_CARD': return <CreditCard className="h-4 w-4" />
        case 'BRIDGE': return <Loader2 className="h-4 w-4" />
        default: return <Banknote className="h-4 w-4" />
    }
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    'CASH': 'Caja Física',
    'CHECKING': 'Banco',
    'DEBIT_CARD': 'Débito Empresa',
    'CREDIT_CARD': 'Crédito Empresa',
    'CHECKBOOK': 'Chequera',
    'BRIDGE': 'Puente',
}

export function TreasuryAccountSelector({
    value,
    onChange,
    placeholder = "Seleccionar...",
    disabled,
    context = 'GENERAL',
    terminalId,
    paymentMethod,
    type,
    accountTypes,
    excludeId,
    allowedIds,
    onSelect,
    label,
    error,
    required
}: TreasuryAccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const { accounts, loading } = useTreasuryAccounts({
        context,
        terminalId,
        paymentMethod,
        excludeId
    })

    // Filter by search, legacy type, accountTypes, and optional allowedIds.
    // `accountTypes` takes precedence over the legacy `type` prop.
    const filteredAccounts = accounts.filter(a => {
        const matchesType = accountTypes
            ? accountTypes.includes(a.account_type as TreasuryAccountType)
            : !type || a.account_type === type
        const matchesAllowed = !allowedIds || allowedIds.includes(a.id)
        const searchLower = search.toLowerCase()
        const matchesSearch = !search ||
            a.name.toLowerCase().includes(searchLower) ||
            a.account_type.toLowerCase().includes(searchLower)
        return matchesType && matchesAllowed && matchesSearch
    })

    const selectedAccount = value && accounts.length > 0
        ? accounts.find(a => a.id.toString() === value.toString()) || null
        : null

    const handleSelect = (account: any) => {
        onChange(account ? account.id.toString() : null)
        if (account && onSelect) onSelect(account)
        setOpen(false)
    }

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
        >
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar cuenta..."
                items={filteredAccounts}
                isLoading={loading}
                selectedId={value ? value.toString() : null}
                getId={(a) => a.id}
                onSelect={handleSelect}
                emptyTitle="No hay cuentas disponibles"
                renderItem={(account) => (
                    <>
                        <Check
                            className={cn(
                                "mr-2 h-4 w-4",
                                selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                            )}
                        />
                        <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{account.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                                </span>
                            </div>
                            {account.current_balance !== undefined && account.current_balance !== null && (
                                <span className="text-xs text-muted-foreground">
                                    Disponible: <MoneyDisplay amount={account.current_balance} inline className="text-xs" />
                                </span>
                            )}
                        </div>
                    </>
                )}
                trigger={
                    <Button
                        variant="ghost"
                        role="combobox"
                        className="w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                        disabled={disabled}
                    >
                        {selectedAccount ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-primary shrink-0">{getIcon(selectedAccount.account_type)}</span>
                                <span className="font-medium text-sm truncate">{selectedAccount.name}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                                    • {formatCurrency(selectedAccount.current_balance || 0)}
                                </span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground truncate">{placeholder}</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                }
            />
        </LabeledContainer>
    )
}
