"use client"

import { useState, useMemo } from "react"
import { Check } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { cn } from "@/lib/utils"

import { BaseModal, LabeledContainer, SearchablePopover, SelectorTrigger, SELECTOR_VALUE_CLASS } from '@/components/shared'
import { Collection, useEntityCollection } from "@/components/entity-view"
import { selectorAccountEntity, selectorAccountViews } from "./entity-view/selectorAccount.entity"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAccountSearch, useSingleAccount } from "@/features/accounting/hooks/useAccountSearch"
import { type Account } from "@/types/entities"

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

export function AccountSelector({ value, onChange, placeholder = "Seleccionar...", accountType, showAll = false, isReconcilable, disabled = false, required, label, error, className }: AccountSelectorProps) {
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

    const accountCollection = useEntityCollection(
        selectorAccountEntity,
        { rows: filteredAccounts, isLoading: accountsLoading },
        { pagination: { mode: "none" } },
    )

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
                    <SelectorTrigger
                        hasValue={!!selectedAccount}
                        placeholder={placeholder}
                        icon={<AccountIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        open={open}
                        disabled={disabled}
                    >
                        <span className="font-mono text-xs font-semibold text-primary shrink-0">{selectedAccount?.code}</span>
                        <span className={cn(SELECTOR_VALUE_CLASS, "truncate")}>{selectedAccount?.name}</span>
                    </SelectorTrigger>
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
                asDialog
                open={modalOpen}
                onOpenChange={setModalOpen}
                size="md"
                title="Búsqueda Avanzada de Cuentas"
                description="Seleccione una cuenta del plan contable."
            >
                <div className="space-y-4 pt-4">
                    <Input
                        value={searchTerm}
                        onChange={(e) => searchAccounts(e.target.value)}
                    />
                    <Collection.Root
                        collection={accountCollection}
                        label="Búsqueda de cuentas"
                        onOpen={handleSelect}
                    >
                        <Collection.View
                            table={selectorAccountViews.table}
                            emptyTitle="No se encontraron resultados"
                        />
                    </Collection.Root>
                </div>
            </BaseModal>
        </LabeledContainer>
    )
}