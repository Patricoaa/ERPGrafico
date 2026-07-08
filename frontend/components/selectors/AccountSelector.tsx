"use client"

import { useState, useMemo } from "react"
import { Check, ChevronDown } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { BaseModal, DataTable, LabeledContainer, SearchablePopover, StatusBadge } from '@/components/shared'
import { Input } from "@/components/ui/input"
import { useAccountSearch, useSingleAccount } from "@/features/accounting/hooks/useAccountSearch"
import { type Account } from "@/types/entities"
import type { ColumnDef } from "@tanstack/react-table"

const AccountIcon = getEntityIcon('accounting.account')

interface AccountSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    accountType?: string | string[]
    showAll?: boolean
    isReconcilable?: boolean
    disabled?: boolean
    required?: boolean
    label?: string
    error?: string
    className?: string
}

const accountColumns: ColumnDef<Account, unknown>[] = [
    {
        id: 'code',
        header: 'Código',
        cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold text-primary">{row.original.code}</span>
        ),
    },
    {
        id: 'name',
        header: 'Nombre',
        cell: ({ row }) => (
            <span className="text-sm truncate">{row.original.name}</span>
        ),
    },
    {
        id: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
            <StatusBadge status={row.original.account_type} size="xs" />
        ),
    },
]

export function AccountSelector({ value, onChange, placeholder = "Seleccionar cuenta...", accountType, showAll = false, isReconcilable, disabled = false, required, label, error, className }: AccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // We fetch all accounts once (or all leaves), and then filter client-side
    const { accounts: allAccounts, loading: accountsLoading } = useAccountSearch("", !showAll)

    // We also fetch the single selected account to ensure it's displayed properly even if not in the list
    const { account: singleAccount } = useSingleAccount(value || null)

    // 1. Filter base accounts (leaf vs parent)
    const selectableAccounts = useMemo(() => {
        if (!Array.isArray(allAccounts)) return []
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
        if (!value) return null
        if (singleAccount && singleAccount.id.toString() === value.toString()) {
            return singleAccount
        }
        if (Array.isArray(allAccounts)) {
            return allAccounts.find((a: Account) => a.id.toString() === value.toString()) || null
        }
        return null
    }, [allAccounts, value, singleAccount])

    const handleSelect = (account: Account | null) => {
        onChange(account ? account.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const searchAccounts = (val: string) => {
        setSearchTerm(val)
    }

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
            className={className}
        >
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={searchTerm}
                onSearchChange={searchAccounts}
                searchPlaceholder="Buscar código o nombre..."
                items={filteredAccounts.slice(0, 20)}
                isLoading={accountsLoading}
                selectedId={value ? value.toString() : null}
                getId={(a) => a.id}
                onSelect={handleSelect}
                emptyTitle="No se encontraron cuentas"
                renderItem={(account) => (
                    <>
                        <Check
                            className={cn(
                                "mr-2 h-4 w-4",
                                selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                            )}
                        />
                        <span className="font-mono text-xs font-semibold text-primary shrink-0 mr-2">{account.code}</span>
                        <span className="text-sm truncate">{account.name}</span>
                    </>
                )}
                trigger={
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                    >
                        {selectedAccount ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <AccountIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-mono text-xs font-semibold shrink-0 text-primary">{selectedAccount.code}</span>
                                <span className="text-sm truncate text-foreground">{selectedAccount.name}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground truncate">{placeholder}</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                }
            >
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setOpen(false)
                        setModalOpen(true)
                    }}
                    className="w-full mb-1 text-xs text-center text-primary hover:underline"
                >
                    Búsqueda avanzada…
                </Button>
            </SearchablePopover>

            <BaseModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                size="md"
                title="Búsqueda Avanzada de Cuentas"
                description="Seleccione una cuenta del plan contable."
            >
                <div className="space-y-4 pt-4">
                    <Input
                        placeholder="Buscar por código o nombre..."
                        value={searchTerm}
                        onChange={(e) => searchAccounts(e.target.value)}
                    />
                    <DataTable
                        variant="compact"
                        gridTemplate="grid-cols-[1fr_2fr_1fr]"
                        columns={accountColumns}
                        data={filteredAccounts}
                        isLoading={accountsLoading}
                        onRowClick={handleSelect}
                        emptyState={{ context: "search", title: "No se encontraron resultados" }}
                    />
                </div>
            </BaseModal>
        </LabeledContainer>
    )
}
