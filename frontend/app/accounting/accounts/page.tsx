"use client"

import { useEffect, useState } from "react"
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
    parent: number | null
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/')
            setAccounts(response.data.results || response.data)
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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Plan de Cuentas</h2>
                <div className="flex items-center space-x-2">
                    <AccountForm accounts={accounts} onSuccess={fetchAccounts} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((account) => (
                            <TableRow key={account.id}>
                                <TableCell className="font-medium">{account.code}</TableCell>
                                <TableCell>{account.name}</TableCell>
                                <TableCell>{account.account_type}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <AccountForm
                                        accounts={accounts}
                                        initialData={account as any}
                                        onSuccess={fetchAccounts}
                                        triggerText="Editar"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(account.id)}
                                    >
                                        Eliminar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">Cargando cuentas...</TableCell>
                            </TableRow>
                        )}
                        {!loading && accounts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No hay cuentas registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
