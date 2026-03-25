"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2, Search, Banknote, CreditCard, Wallet, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useTreasuryAccounts, PaymentContext } from "@/hooks/useTreasuryAccounts"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"

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
    type?: 'BANK' | 'CASH'

    // Exclude specific account
    excludeId?: number

    // Optional: Return full account object on select
    onSelect?: (account: any) => void
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
    excludeId,
    onSelect
}: TreasuryAccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const { accounts, loading } = useTreasuryAccounts({
        context,
        terminalId,
        paymentMethod,
        excludeId
    })

    // Filter by search and legacy type
    const filteredAccounts = accounts.filter(a => {
        const matchesType = !type || a.account_type === type
        const searchLower = search.toLowerCase()
        const matchesSearch = !search || 
            a.name.toLowerCase().includes(searchLower) || 
            a.account_type.toLowerCase().includes(searchLower)
        return matchesType && matchesSearch
    })
    
    const selectedAccount = value && accounts.length > 0
        ? accounts.find(a => a.id.toString() === value.toString()) || null
        : null

    const getIcon = (accountType: string) => {
        switch (accountType) {
            case 'BANK': return <Landmark className="h-4 w-4" />
            case 'CASH': return <Wallet className="h-4 w-4" />
            case 'CARD': return <CreditCard className="h-4 w-4" />
            default: return <Banknote className="h-4 w-4" />
        }
    }

    const handleSelect = (account: any) => {
        onChange(account ? account.id.toString() : null)
        if (account && onSelect) onSelect(account)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto py-2 px-3"
                    disabled={disabled}
                >
                    {selectedAccount ? (
                        <div className="flex items-center gap-2 truncate">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                {getIcon(selectedAccount.account_type)}
                            </div>
                            <div className="flex flex-col items-start truncate">
                                <span className="font-medium text-sm leading-tight">{selectedAccount.name}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">
                                    {selectedAccount.account_type} • {formatCurrency(selectedAccount.current_balance || 0)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar cuenta..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs border-none bg-muted focus-visible:ring-0"
                        />
                    </div>
                </div>
                <div className="p-1 max-h-[300px] overflow-y-auto space-y-0.5">
                    {loading ? (
                        <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="p-4 text-sm text-center">No hay cuentas disponibles.</div>
                    ) : (
                        filteredAccounts.map((account) => (
                            <div
                                key={account.id}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    selectedAccount?.id === account.id && "bg-accent"
                                )}
                                onClick={() => handleSelect(account)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{account.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{account.account_type}</span>
                                    </div>
                                    {account.current_balance !== undefined && account.current_balance !== null && (
                                        <span className="text-xs text-muted-foreground">
                                            Disponible: ${Number(account.current_balance).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

