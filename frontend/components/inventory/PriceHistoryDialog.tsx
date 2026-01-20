"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Loader2, History, TrendingUp, TrendingDown, Minus } from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Badge } from "@/components/ui/badge"

interface PriceHistoryDialogProps {
    productId: number | null
    productName: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface PriceHistoryEntry {
    history_date: string
    history_user: string
    sale_price: number
    cost_price: number
    old_sale_price: number | null
    old_cost_price: number | null
    history_type: string
}

export function PriceHistoryDialog({ productId, productName, open, onOpenChange }: PriceHistoryDialogProps) {
    const [history, setHistory] = useState<PriceHistoryEntry[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && productId) {
            fetchHistory()
        }
    }, [open, productId])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/inventory/products/${productId}/price_history/`)
            setHistory(res.data)
        } catch (error) {
            console.error("Error fetching price history:", error)
        } finally {
            setLoading(false)
        }
    }

    const renderPriceChange = (current: number, old: number | null) => {
        if (old === null) return <DataCell.Currency value={current} className="text-left" />

        const diff = current - old
        const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
        const colorClass = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-muted-foreground"

        return (
            <div className="flex flex-col">
                <div className="flex items-center gap-1">
                    <DataCell.Currency value={current} className="font-bold text-left" />
                    <Icon className={`h-3 w-3 ${colorClass}`} />
                </div>
                {diff !== 0 && (
                    <div className="text-[10px] text-muted-foreground">
                        Antes: <DataCell.Currency value={old} className="inline italic text-[10px]" />
                    </div>
                )}
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <DialogTitle>Historial de Precios y Costos</DialogTitle>
                    </div>
                    {productName && (
                        <p className="text-sm text-muted-foreground">
                            {productName}
                        </p>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-auto mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No hay cambios registrados en precios o costos para este producto.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[150px]">Fecha</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Precio de Venta</TableHead>
                                        <TableHead>Costo Ponderado</TableHead>
                                        <TableHead className="text-right">Tipo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((entry, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs">
                                                {format(new Date(entry.history_date), "dd/MM/yyyy HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">
                                                <Badge variant="secondary" className="font-normal">
                                                    {entry.history_user}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {renderPriceChange(entry.sale_price, entry.old_sale_price)}
                                            </TableCell>
                                            <TableCell>
                                                {renderPriceChange(entry.cost_price, entry.old_cost_price)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {entry.history_type === '+' ? 'Inicial' : 'Cambio'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
