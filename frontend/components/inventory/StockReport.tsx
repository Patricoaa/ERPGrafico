"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, Download, RefreshCw, Check, X } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AdjustmentForm } from "@/components/inventory/AdjustmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRightLeft } from "lucide-react"

export function StockReport() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [isRotating, setIsRotating] = useState<number | null>(null)
    const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)

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

    const handleRotateUom = async (product: any) => {
        setIsRotating(product.id)
        try {
            const res = await api.post(`/inventory/products/${product.id}/rotate_uom/`)
            toast.success(`Unidad de ${product.name} cambiada a ${res.data.new_uom}`)
            fetchReport()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cambiar unidad")
        } finally {
            setIsRotating(null)
        }
    }

    const filtered = report.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-lg font-semibold whitespace-nowrap">Reporte de Valorización</h3>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar producto..."
                            className="pl-8 h-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="w-[100px]">Cod. Int.</TableHead>
                            <TableHead>SKU/Code</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Stock Actual</TableHead>
                            <TableHead className="text-right">Costo Unit.</TableHead>
                            <TableHead className="text-right">Valorización</TableHead>
                            <TableHead className="text-right text-emerald-600">Entradas</TableHead>
                            <TableHead className="text-right text-rose-600">Salidas</TableHead>
                            <TableHead className="text-center w-[100px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-10">Cargando reporte...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center py-10 italic text-muted-foreground">No se encontraron productos.</TableCell></TableRow>
                        ) : filtered.map((item) => (
                            <TableRow key={item.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-mono text-[10px] font-bold text-primary">
                                    {item.internal_code}
                                </TableCell>
                                <TableCell className="font-mono text-[10px] text-muted-foreground">{item.code}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{item.category_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums">
                                    {Math.round(item.stock_qty * 100) / 100} <span className="text-[10px] text-muted-foreground font-normal lowercase">{item.uom_name}</span>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                    ${Math.round(item.unit_cost).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-black tabular-nums text-primary">
                                    ${Math.round(item.total_value).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 font-medium text-xs">
                                    {item.moves_in > 0 ? `+${Math.round(item.moves_in * 100) / 100}` : '0'}
                                </TableCell>
                                <TableCell className="text-right text-rose-600 font-medium text-xs">
                                    {item.moves_out > 0 ? `-${Math.round(item.moves_out * 100) / 100}` : '0'}
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex gap-1 justify-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => setAdjustingProduct(item)}
                                            title="Ajustar Stock"
                                        >
                                            <ArrowRightLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => handleRotateUom(item)}
                                            disabled={isRotating === item.id}
                                            title="Rotar Unidad de Medida (Convierte Cantidades)"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isRotating === item.id ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Ajustar Stock: {adjustingProduct?.name}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Stock actual: <span className="font-bold">{adjustingProduct?.stock_qty} {adjustingProduct?.uom_name}</span> •
                            Costo unitario: <span className="font-bold">${adjustingProduct?.unit_cost}</span>
                        </p>
                    </DialogHeader>
                    {adjustingProduct && (
                        <AdjustmentForm
                            preSelectedProduct={adjustingProduct.id.toString()}
                            onSuccess={() => {
                                setAdjustingProduct(null);
                                fetchReport();
                            }}
                            onCancel={() => setAdjustingProduct(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
