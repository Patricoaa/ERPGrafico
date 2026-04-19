"use client"

import { useState, useEffect, useMemo } from "react"
import { Check, ChevronsUpDown, Search, Loader2, BookKey } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { BaseModal } from "@/components/shared/BaseModal"
import { EmptyState } from "@/components/shared/EmptyState"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAccountSearch } from "@/features/accounting/hooks/useAccountSearch"
import { Account } from "@/types/entities"

interface AccountSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    accountType?: string | string[]
    showAll?: boolean
    isReconcilable?: boolean
}

export function AccountSelector({ value, onChange, placeholder = "Seleccionar cuenta...", accountType, showAll = false, isReconcilable }: AccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const { accounts: allAccounts, loading: accountsLoading, fetchAccounts } = useAccountSearch()
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchAccounts("", !showAll)
    }, [fetchAccounts, showAll])

    // 1. Filter base accounts (leaf vs parent)
    const selectableAccounts = useMemo(() => {
        if (!allAccounts) return []
        return allAccounts.filter((a: Account) => {
            const isReconcilableMatch = isReconcilable !== undefined ? a.is_reconcilable === isReconcilable : true;

            if (showAll) {
                // When selecting a parent, exclude Level 1 (roots)
                return a.code.includes('.') && isReconcilableMatch;
            }
            // For journal entries, only show leaf accounts
            return a.is_selectable !== false && isReconcilableMatch;
        })
    }, [allAccounts, showAll, isReconcilable])

    // 2. Filter by type if provided
    const typedAccounts = useMemo(() => {
        if (!accountType) return selectableAccounts
        return selectableAccounts.filter((a: Account) => {
            if (Array.isArray(accountType)) return accountType.includes(a.account_type)
            return a.account_type === accountType
        })
    }, [selectableAccounts, accountType])

    // 3. Filter by search term
    const filteredAccounts = useMemo(() => {
        const lowerVal = searchTerm.toLowerCase()
        if (!lowerVal) return typedAccounts
        return typedAccounts.filter(a =>
            a.code.toLowerCase().includes(lowerVal) ||
            a.name.toLowerCase().includes(lowerVal)
        )
    }, [typedAccounts, searchTerm])

    // 4. Find selected account
    const selectedAccount = useMemo(() => {
        if (!value || !allAccounts) return null
        return allAccounts.find((a: Account) => a.id.toString() === value.toString()) || null
    }, [allAccounts, value])

    const handleSelect = (account: Account | null) => {
        onChange(account ? account.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const searchAccounts = (val: string) => {
        setSearchTerm(val)
    }

    return (
        <div className="flex gap-2 w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="flex-1 justify-between overflow-hidden h-auto py-2 px-3"
                    >
                        {selectedAccount ? (
                            <div className="flex items-center gap-2 truncate text-left">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                    <BookKey className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-start truncate leading-tight">
                                    <span className="font-medium text-sm truncate w-full">{selectedAccount.code}</span>
                                    <span className="text-[10px] text-muted-foreground truncate w-full">{selectedAccount.name}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar código o nombre..."
                                value={searchTerm}
                                onChange={(e) => searchAccounts(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {accountsLoading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : filteredAccounts.length === 0 ? (
                                <EmptyState context="search" variant="compact" title="No se encontraron cuentas" />
                            ) : (
                                filteredAccounts.slice(0, 20).map((account) => (
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
                                        {account.code} - {account.name}
                                    </div>
                                ))
                            )}
                            {filteredAccounts.length > 20 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false)
                                        setModalOpen(true)
                                    }}
                                    className="w-full p-2 text-xs text-center text-primary hover:underline border-t"
                                >
                                    Use búsqueda avanzada para ver más...
                                </button>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <BaseModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                size="md"
                title="Búsqueda Avanzada de Cuentas"
                description="Seleccione una cuenta del plan contable."
            >
                <div className="space-y-4 pt-4">
                    <Input
                        placeholder="Filtrar por código o nombre..."
                        value={searchTerm}
                        onChange={(e) => searchAccounts(e.target.value)}
                    />
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/3">Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tipo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAccounts.map((account) => (
                                    <TableRow
                                        key={account.id}
                                        className="cursor-pointer hover:bg-accent"
                                        onClick={() => handleSelect(account)}
                                    >
                                        <TableCell className="font-mono">{account.code}</TableCell>
                                        <TableCell>{account.name}</TableCell>
                                        <TableCell>{account.account_type}</TableCell>
                                    </TableRow>
                                ))}
                                {filteredAccounts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <EmptyState context="search" variant="compact" title="No se encontraron resultados" />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </BaseModal>
        </div>
    )
}
