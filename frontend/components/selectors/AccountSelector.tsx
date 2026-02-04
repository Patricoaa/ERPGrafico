"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"

interface AccountSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    accountType?: string | string[]
    showAll?: boolean
}

export function AccountSelector({ value, onChange, placeholder = "Seleccionar cuenta...", accountType, showAll = false }: AccountSelectorProps) {
    const [open, setOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [filteredAccounts, setFilteredAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAccount, setSelectedAccount] = useState<any>(null)

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true)
            try {
                let url = `/accounting/accounts/${showAll ? '' : '?is_leaf=true'}`
                const res = await api.get(url)
                const allAccounts = res.data.results || res.data

                // Always filter by is_selectable (Structural accounts shouldn't be picked)
                const selectableAccounts = allAccounts.filter((a: any) => a.is_selectable !== false)

                // Filter by type if provided
                const filteredByType = accountType
                    ? selectableAccounts.filter((a: any) => {
                        if (Array.isArray(accountType)) return accountType.includes(a.account_type)
                        return a.account_type === accountType
                    })
                    : selectableAccounts

                setAccounts(filteredByType)
                setFilteredAccounts(filteredByType)

                if (value) {
                    const found = allAccounts.find((a: any) => a.id.toString() === value.toString())
                    setSelectedAccount(found)
                }
            } catch (error) {
                console.error("Error fetching accounts", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAccounts()
    }, [accountType, value])

    const handleSelect = (account: any) => {
        setSelectedAccount(account)
        onChange(account ? account.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const searchAccounts = (val: string) => {
        setSearchTerm(val)
        const lowerVal = val.toLowerCase()
        setFilteredAccounts(
            accounts.filter(a =>
                a.code.toLowerCase().includes(lowerVal) ||
                a.name.toLowerCase().includes(lowerVal)
            )
        )
    }

    return (
        <div className="flex gap-2 w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="flex-1 justify-between"
                    >
                        {selectedAccount
                            ? `${selectedAccount.code} - ${selectedAccount.name}`
                            : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
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
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : filteredAccounts.length === 0 ? (
                                <div className="p-4 text-sm text-center">No se encontraron cuentas.</div>
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
                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                            No se encontraron resultados.
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
