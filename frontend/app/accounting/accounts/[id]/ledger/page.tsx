"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

export default function AccountLedgerPage() {
    const params = useParams()
    const router = useRouter()
    const accountId = params.id as string

    const [account, setAccount] = useState<any>(null)
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (accountId) {
            fetchLedger()
        }
    }, [accountId])

    const fetchLedger = async () => {
        try {
            const res = await api.get(`/accounting/accounts/${accountId}/ledger/`)
            setAccount(res.data.account)
            setMovements(res.data.movements)
        } catch (error) {
            toast.error("Error al cargar el libro mayor")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="p-6">Cargando...</div>
    }

    if (!account) {
        return <div className="p-6">Cuenta no encontrada</div>
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Libro Mayor</h1>
                    <p className="text-muted-foreground">
                        {account.code} - {account.name}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Movimientos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Referencia</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Tercero</TableHead>
                                    <TableHead className="text-right">Debe</TableHead>
                                    <TableHead className="text-right">Haber</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No hay movimientos registrados
                                        </TableCell>
                                    </TableRow>
                                ) : movements.map((mov) => (
                                    <TableRow key={mov.id}>
                                        <TableCell>{mov.date}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <a
                                                    href={`/accounting/entries`}
                                                    className="text-blue-600 hover:underline text-sm font-medium"
                                                >
                                                    {mov.reference || `Asiento ${mov.entry_id}`}
                                                </a>
                                                {mov.source_document && (
                                                    <a
                                                        href={mov.source_document.url}
                                                        className="text-[10px] text-muted-foreground hover:text-blue-500 underline uppercase font-bold"
                                                    >
                                                        {mov.source_document.type}: {mov.source_document.name}
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-md truncate">{mov.description}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{mov.partner}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {mov.debit > 0 ? `$${mov.debit.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {mov.credit > 0 ? `$${mov.credit.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">
                                            ${mov.balance.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
