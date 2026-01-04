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
    move_type: string
    description: string
}

export default function MovementsPage() {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingMove, setViewingMove] = useState<number | null>(null)

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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Movimientos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{moves.length}</div>
                    </CardContent>
                </Card>
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
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10">Cargando movimientos...</TableCell>
                            </TableRow>
                        ) : moves.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No hay movimientos registrados.</TableCell>
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
                                <TableCell>
                                    <Badge variant={move.move_type === 'IN' ? 'default' : move.move_type === 'OUT' ? 'destructive' : 'outline'}>
                                        {move.move_type === 'IN' ? 'Entrada' : move.move_type === 'OUT' ? 'Salida' : 'Ajuste'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{move.description}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setViewingMove(move.id)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {viewingMove && (
                <TransactionViewModal
                    open={!!viewingMove}
                    onOpenChange={(open) => !open && setViewingMove(null)}
                    type="inventory"
                    id={viewingMove}
                />
            )}
        </div>
    )
}
