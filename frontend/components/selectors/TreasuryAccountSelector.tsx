"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useTreasuryAccounts, PaymentContext } from "@/hooks/useTreasuryAccounts"

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
}

export function TreasuryAccountSelector({
    value,
    onChange,
    placeholder = "Seleccionar...",
    disabled,
    context = 'GENERAL',
    terminalId,
    paymentMethod,
    type
}: TreasuryAccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<any>(null)

    const { accounts, loading } = useTreasuryAccounts({
        context,
        terminalId,
        paymentMethod
    })

    // Filter by legacy type if provided (on top of hook filters)
    const filteredAccounts = type
        ? accounts.filter(a => a.account_type === type)
        : accounts

    useEffect(() => {
        if (value && filteredAccounts.length > 0) {
            const found = filteredAccounts.find(a => a.id.toString() === value.toString())
            setSelectedAccount(found)
        } else if (!value) {
            setSelectedAccount(null)
        }
    }, [value, filteredAccounts])

    const handleSelect = (account: any) => {
        setSelectedAccount(account)
        onChange(account ? account.id.toString() : null)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedAccount
                        ? `${selectedAccount.name} (${selectedAccount.currency})`
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <div className="p-2 max-h-[200px] overflow-y-auto space-y-1">
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
                                {account.name}
                                <span className="ml-auto text-xs text-muted-foreground">{account.account_type}</span>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

