"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

export default function StockReportPage() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchReport()
    }, [])

    const fetchReport = async () => {
        try {
            const res = await api.get('/inventory/products/stock_report/')
            setReport(res.data)
        } catch (error) {
            toast.error("Error al cargar el reporte de stock")
        } finally {
            setLoading(false)
        }
    }

    const filtered = report.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Reporte de Stock</h1>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por código o nombre..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Stock Actual</TableHead>
                                    <TableHead>Unidad</TableHead>
                                    <TableHead className="text-right">Costo Unit.</TableHead>
                                    <TableHead className="text-right">Valorización</TableHead>
                                    <TableHead className="text-right text-green-600">Entradas</TableHead>
                                    <TableHead className="text-right text-red-600">Salidas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-10">Cargando...</TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No se encontraron productos.</TableCell></TableRow>
                                ) : filtered.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono">{item.code}</TableCell>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.category_name}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {Math.round(item.stock_qty).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{item.uom_name}</TableCell>
                                        <TableCell className="text-right">
                                            ${Math.round(item.unit_cost).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${Math.round(item.total_value).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600">
                                            {item.moves_in > 0 ? `+${Math.round(item.moves_in).toLocaleString()}` : '0'}
                                        </TableCell>
                                        <TableCell className="text-right text-red-600">
                                            {item.moves_out > 0 ? `-${Math.round(item.moves_out).toLocaleString()}` : '0'}
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
