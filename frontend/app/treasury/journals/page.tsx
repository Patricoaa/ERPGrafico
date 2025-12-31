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
import api from "@/lib/api"
import { BankJournalForm } from "@/components/forms/BankJournalForm"

interface Journal {
    id: number
    name: string
    code: string
    currency: string
    account: number
}

export default function JournalsPage() {
    const [journals, setJournals] = useState<Journal[]>([])
    const [loading, setLoading] = useState(true)

    const fetchJournals = async () => {
        try {
            const response = await api.get('/treasury/journals/')
            setJournals(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch journals", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchJournals()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Cajas y Bancos</h2>
                <div className="flex items-center space-x-2">
                    <BankJournalForm onSuccess={fetchJournals} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Moneda</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {journals.map((journal) => (
                            <TableRow key={journal.id}>
                                <TableCell className="font-medium">{journal.name}</TableCell>
                                <TableCell>{journal.code}</TableCell>
                                <TableCell>{journal.currency}</TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">Cargando registros...</TableCell>
                            </TableRow>
                        )}
                        {!loading && journals.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No hay cajas ni bancos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
