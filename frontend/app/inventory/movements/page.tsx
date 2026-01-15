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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

interface StockMove {
    id: number
    date: string
    product_name: string
    warehouse_name: string
    quantity: string
    uom_name: string
    move_type: string
    description: string
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}

export default function MovementsPage() {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)

    const fetchMoves = async () => {
        setLoading(true)
        try {
            const response = await api.get('/inventory/moves/')
            setMoves(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch stock moves", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMoves()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Movimientos de Inventario</h2>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Almacén</TableHead>
                            <TableHead>Cant.</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Documentos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-10">Cargando movimientos...</TableCell>
                            </TableRow>
                        ) : moves.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No hay movimientos registrados.</TableCell>
                            </TableRow>
                        ) : moves.map((move) => (
                            <TableRow key={move.id}>
                                <TableCell className="font-mono text-xs">MOV-{move.id.toString().padStart(6, '0')}</TableCell>
                                <TableCell>{new Date(move.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{move.product_name}</TableCell>
                                <TableCell>{move.warehouse_name}</TableCell>
                                <TableCell className={parseFloat(move.quantity) > 0 ? "text-green-600 font-medium" : "text-red-600 font-bold"}>
                                    {Math.round(Math.abs(parseFloat(move.quantity)))}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{move.uom_name}</TableCell>
                                <TableCell>
                                    <Badge variant={move.move_type === 'IN' ? 'default' : move.move_type === 'OUT' ? 'destructive' : 'outline'}>
                                        {move.move_type === 'IN' ? 'Entrada' : move.move_type === 'OUT' ? 'Salida' : 'Ajuste'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {move.related_documents && move.related_documents.filter(d => d.type !== 'inventory').length > 0 ? (
                                            move.related_documents
                                                .filter(d => d.type !== 'inventory')
                                                .map((doc, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                                        className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">
                                                            {doc.type === 'invoice' ? (doc.name.includes('BOL') ? 'Boleta' :
                                                                doc.name.includes('NC') ? 'Nota de Crédito' :
                                                                    doc.name.includes('ND') ? 'Nota de Débito' : 'Factura') :
                                                                doc.type === 'purchase_order' ? 'Orden de Compra' :
                                                                    doc.type === 'sale_order' ? 'Nota de Venta' : doc.type}
                                                        </span>
                                                        {doc.name}
                                                    </button>
                                                ))
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setViewingTransaction({ type: 'inventory', id: move.id })}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

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
