"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Search, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

export default function SalesInvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)

    useEffect(() => {
        fetchInvoices()
    }, [])

    const fetchInvoices = async () => {
        try {
            const res = await api.get('/billing/invoices/')
            // Filter only sales
            const results = res.data.results || res.data
            setInvoices(results.filter((i: any) => i.sale_order))
        } catch (error) {
            toast.error("Error al cargar facturas")
        } finally {
            setLoading(false)
        }
    }

    const filtered = invoices.filter(i =>
        (i.number && i.number.includes(searchTerm)) ||
        (i.partner_name && i.partner_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Documentos Emitidos</h1>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por número o cliente..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Número</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10">Cargando...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No se encontraron documentos.</TableCell></TableRow>
                            ) : filtered.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>{inv.date}</TableCell>
                                    <TableCell>{inv.dte_type_display}</TableCell>
                                    <TableCell>
                                        <span className="font-mono font-medium">{inv.number || '---'}</span>
                                    </TableCell>
                                    <TableCell>{inv.partner_name}</TableCell>
                                    <TableCell>
                                        <button
                                            onClick={() => setViewingTransaction({ type: 'sale_order', id: inv.sale_order })}
                                            className="text-blue-600 hover:underline text-xs font-medium"
                                        >
                                            NV-{inv.sale_order_number}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        ${Number(inv.total).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'POSTED' ? 'info' : 'secondary'}>
                                            {inv.status_display}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id })}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                />
            )}
        </div>
    )
}
