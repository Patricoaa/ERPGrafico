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
import api from "@/lib/api"

interface TreasuryAccountSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    type?: 'BANK' | 'CASH' // Filter by type
    disabled?: boolean
}

export function TreasuryAccountSelector({ value, onChange, placeholder = "Seleccionar...", type, disabled }: TreasuryAccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<any>(null)

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true)
            try {
                const res = await api.get('/treasury/accounts/')
                let allAccounts = res.data.results || res.data

                if (type) {
                    allAccounts = allAccounts.filter((a: any) => a.account_type === type)
                }

                setAccounts(allAccounts)

                if (value) {
                    const found = allAccounts.find((a: any) => a.id.toString() === value.toString())
                    setSelectedAccount(found)
                } else {
                    setSelectedAccount(null)
                }
            } catch (error) {
                console.error("Error fetching treasury accounts", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAccounts()
    }, [type])

    // Update selected if value changes externally
    useEffect(() => {
        if (value && accounts.length > 0) {
            const found = accounts.find((a: any) => a.id.toString() === value.toString())
            setSelectedAccount(found)
        } else if (!value) {
            setSelectedAccount(null)
        }
    }, [value, accounts])


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
                    ) : accounts.length === 0 ? (
                        <div className="p-4 text-sm text-center">No hay cuentas disponibles.</div>
                    ) : (
                        accounts.map((account) => (
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
