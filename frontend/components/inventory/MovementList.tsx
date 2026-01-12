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
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentList } from "@/components/inventory/AdjustmentList"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus } from "lucide-react"

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

export function MovementList() {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Historial de Movimientos</h3>
                <Button onClick={() => setShowAdjustmentModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Ajuste
                </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Almacén</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Documentos</TableHead>
                            <TableHead className="w-[80px] text-center">Ver</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-10">Cargando movimientos...</TableCell></TableRow>
                        ) : moves.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-10 italic text-muted-foreground">No hay movimientos registrados.</TableCell></TableRow>
                        ) : moves.map((move) => (
                            <TableRow key={move.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-mono text-[10px] text-muted-foreground">MOV-{move.id.toString().padStart(6, '0')}</TableCell>
                                <TableCell className="text-sm whitespace-nowrap">{new Date(move.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{move.product_name}</TableCell>
                                <TableCell className="text-sm">{move.warehouse_name}</TableCell>
                                <TableCell className={`text-right font-bold tabular-nums ${parseFloat(move.quantity) > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {Math.abs(parseFloat(move.quantity))}
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground font-medium uppercase">{move.uom_name}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={move.move_type === 'IN' ? 'default' : move.move_type === 'OUT' ? 'destructive' : 'secondary'}
                                        className={`text-[10px] gap-1 ${move.move_type === 'ADJ' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' : ''}`}
                                    >
                                        {move.move_type === 'ADJ' && <span className="text-[8px]">🔄</span>}
                                        {move.move_type === 'IN' ? 'Entrada' : move.move_type === 'OUT' ? 'Salida' : 'Ajuste'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1 max-w-[200px]">
                                        {move.related_documents && move.related_documents.filter(d => d.type !== 'inventory').length > 0 ? (
                                            move.related_documents
                                                .filter(d => d.type !== 'inventory')
                                                .map((doc, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                                        className="text-primary hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-bold uppercase text-[7px] text-muted-foreground/70">
                                                            {doc.type === 'invoice' ? (doc.name.includes('BOL') ? 'Boleta' :
                                                                doc.name.includes('NC') ? 'Nota de Crédito' :
                                                                    doc.name.includes('ND') ? 'Nota de Débito' : 'Factura') :
                                                                doc.type === 'purchase_order' ? 'Orden de Compra' :
                                                                    doc.type === 'sale_order' ? 'Orden de Venta' : doc.type}
                                                        </span>
                                                        <span className="truncate w-full">{doc.name}</span>
                                                    </button>
                                                ))
                                        ) : (
                                            <span className="text-muted-foreground text-xs italic opacity-50">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setViewingTransaction({ type: 'inventory', id: move.id })}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
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

            <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nuevo Ajuste de Stock</DialogTitle>
                    </DialogHeader>
                    <AdjustmentList onSuccess={() => { setShowAdjustmentModal(false); fetchMoves(); }} />
                </DialogContent>
            </Dialog>
        </div>
    )
}
