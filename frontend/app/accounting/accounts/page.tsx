"use client"

import React, { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"

import { AccountForm } from "@/components/forms/AccountForm"

interface Account {
    id: number
    code: string
    name: string
    account_type: string
    account_type_display: string
    parent: number | null
    debit_total: string
    credit_total: string
    balance: string
}

const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/')
            const data = response.data.results || response.data
            // Sorting is already done by backend (ordering = ['code']), 
            // but we can ensure it here or re-sort if grouping changes order
            setAccounts(data)
        } catch (error) {
            console.error("Failed to fetch accounts", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta cuenta?")) return
        try {
            await api.delete(`/accounting/accounts/${id}/`)
            await fetchAccounts()
        } catch (error) {
            console.error("Error deleting account:", error)
            alert("Error al eliminar la cuenta. Verifique que no tenga movimientos asociados.")
        }
    }

    // Group accounts by type for display
    const groupedAccounts = typeOrder.map(type => ({
        type,
        label: accounts.find(a => a.account_type === type)?.account_type_display || type,
        items: accounts.filter(a => a.account_type === type)
    })).filter(g => g.items.length > 0)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Plan de Cuentas</h2>
                <div className="flex items-center space-x-2">
                    <AccountForm accounts={accounts} onSuccess={fetchAccounts} />
                </div>
            </div>
            <div className="rounded-md border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[120px]">Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="text-right w-[150px]">Debe</TableHead>
                            <TableHead className="text-right w-[150px]">Haber</TableHead>
                            <TableHead className="text-right w-[150px]">Saldo</TableHead>
                            <TableHead className="text-right w-[120px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">Cargando cuentas...</TableCell>
                            </TableRow>
                        ) : groupedAccounts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">No hay cuentas registradas.</TableCell>
                            </TableRow>
                        ) : groupedAccounts.map((group) => (
                            <React.Fragment key={group.type}>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableCell colSpan={6} className="font-bold text-primary py-2 px-4 uppercase text-xs tracking-wider">
                                        {group.label}
                                    </TableCell>
                                </TableRow>
                                {group.items.map((account) => (
                                    <TableRow key={account.id}>
                                        <TableCell className="font-mono text-xs">{account.code}</TableCell>
                                        <TableCell className="font-medium">{account.name}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {parseFloat(account.debit_total) !== 0 ? Number(account.debit_total).toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {parseFloat(account.credit_total) !== 0 ? Number(account.credit_total).toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            ${Number(account.balance).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <AccountForm
                                                accounts={accounts}
                                                initialData={account as any}
                                                onSuccess={fetchAccounts}
                                                triggerText="Editar"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
