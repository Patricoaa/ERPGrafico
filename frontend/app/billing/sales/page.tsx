"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, Banknote, History, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

export default function SalesInvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)

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

    const handleAnnul = async (id: number) => {
        if (!confirm("¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/billing/invoices/${id}/annul/`)
            toast.success("Documento anulado correctamente.")
            fetchInvoices()
        } catch (error: any) {
            console.error("Error annulling invoice:", error)
            toast.error(error.response?.data?.error || "Error al anular el documento.")
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
                                <TableHead>Número</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10">Cargando...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No se encontraron documentos.</TableCell></TableRow>
                            ) : filtered.map((inv) => (
                                <TableRow key={inv.id}>
                                    <TableCell>
                                        <span className="font-mono font-medium">{inv.number || '---'}</span>
                                    </TableCell>
                                    <TableCell>{inv.date}</TableCell>
                                    <TableCell>{inv.dte_type_display}</TableCell>
                                    <TableCell>{inv.partner_name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => setViewingTransaction({ type: 'sale_order', id: inv.sale_order })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">Orden de Venta</span>
                                                NV-{inv.sale_order_number}
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        ${Number(inv.total).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'POSTED' ? 'info' : inv.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                                            {inv.status === 'CANCELLED' ? 'Anulado' : inv.status_display}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                                title="Ver Detalle"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {(inv.related_documents?.payments?.length ?? 0) > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-emerald-600"
                                                    onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'history' })}
                                                    title="Historial de Pagos"
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {inv.status !== 'CANCELLED' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleAnnul(inv.id)}
                                                    title="Anular Documento"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
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
                    view={viewingTransaction.view}
                />
            )}
        </div>
    )
}
