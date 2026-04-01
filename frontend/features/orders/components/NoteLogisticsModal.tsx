"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Package, AlertTriangle, CheckCircle2, ArrowLeftRight } from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"

interface InvoiceLine {
    product_id: number
    product_name: string
    quantity: number
    quantity_delivered?: number
    quantity_received?: number
    uom_id?: number
    uom_name?: string
}

interface NoteLogisticsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoice: any
    onSuccess?: () => void
}

export function NoteLogisticsModal({ open, onOpenChange, invoice, onSuccess }: NoteLogisticsModalProps) {
    const { dateString } = useServerDate()
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [processQuantities, setProcessQuantities] = useState<{ [pId: number]: number }>({})
    const [displayLines, setDisplayLines] = useState<InvoiceLine[]>(invoice?.lines || [])
    const [date, setDate] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Sync date with server date
    useEffect(() => {
        if (dateString && !date) {
            setDate(dateString)
        }
    }, [dateString])

    const isSale = !!invoice?.sale_order || !!invoice?.sale_order_number
    const isCredit = invoice?.dte_type === 'NOTA_CREDITO'
    // const lines = invoice?.lines || [] // REMOVED: Use displayLines instead

    useEffect(() => {
        if (open && invoice) {
            // Reset display lines to props initially while loading fresh data
            setDisplayLines(invoice.lines || [])
            fetchData()
        }
    }, [open, invoice])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch warehouses
            const warehousesResponse = await api.get('/inventory/warehouses/')
            const warehousesList = warehousesResponse.data.results || warehousesResponse.data
            setWarehouses(warehousesList)

            if (warehousesList.length > 0) {
                setSelectedWarehouse(warehousesList[0].id)
            }

            // Fetch FRESH invoice data to ensure we have latest 'quantity_delivered'/'quantity_received'
            // The serializer logic augments these fields with (Sum of Returns)
            const invoiceResponse = await api.get(`/billing/invoices/${invoice.id}/`)
            const freshInvoice = invoiceResponse.data
            const freshLines = freshInvoice.lines || []

            setDisplayLines(freshLines)

            // Initialize quantities with pending based on FRESH data
            const initial: { [pId: number]: number } = {}
            freshLines.forEach((line: InvoiceLine) => {
                // Determine processed qty based on type
                // Note: The serializer returns 'quantity_delivered' for Sales (even if it's returns for NC)
                // and 'quantity_received' for Purchases.
                const processed = isSale ? (line.quantity_delivered || 0) : (line.quantity_received || 0)
                const pending = Math.max(0, line.quantity - processed)
                initial[line.product_id] = pending
            })
            setProcessQuantities(initial)
        } catch (error) {
            console.error("Error fetching data:", error)
            toast.error("Error al cargar datos actualizados del documento")
        } finally {
            setLoading(false)
        }
    }

    const handleQuantityChange = (pId: number, value: string, max: number) => {
        const num = parseFloat(value) || 0
        setProcessQuantities(prev => ({ ...prev, [pId]: Math.min(num, max) }))
    }

    const handleSubmit = async () => {
        if (!selectedWarehouse) {
            toast.error("Seleccione una bodega")
            return
        }

        const lineData = Object.entries(processQuantities)
            .filter(([_, qty]) => qty > 0)
            .map(([pId, qty]) => ({
                product_id: parseInt(pId),
                quantity: qty
            }))

        if (lineData.length === 0) {
            toast.error("Ingrese al menos una cantidad a procesar")
            return
        }

        setSubmitting(true)
        try {
            await api.post(`/billing/invoices/${invoice.id}/process_logistics/`, {
                warehouse_id: selectedWarehouse,
                date: date,
                line_data: lineData,
                notes: notes
            })

            toast.success("Logística procesada correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error processing logistics:", error)
            showApiError(error, "Error al procesar logística")
        } finally {
            setSubmitting(false)
        }
    }

    const title = isCredit
        ? (isSale ? "Registrar Devolución de Venta" : "Registrar Devolución a Proveedor")
        : (isSale ? "Registrar Despacho Suplementario" : "Registrar Recepción Suplementaria")

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={title}
            description={`Documento: ${invoice?.display_id} | ${isSale ? "Cliente" : "Proveedor"}: ${invoice?.partner_name}`}
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={submitting || loading}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Movimiento
                    </Button>
                </>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bodega</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedWarehouse || ''}
                                onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
                            >
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-center">Cant. Nota</TableHead>
                                    <TableHead className="text-center">Procesado</TableHead>
                                    <TableHead className="text-center">Pendiente</TableHead>
                                    <TableHead className="text-center w-32">A Procesar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayLines.map((line: any) => {
                                    const processed = isSale ? (line.quantity_delivered || 0) : (line.quantity_received || 0)
                                    const pending = Math.max(0, line.quantity - processed)

                                    return (
                                        <TableRow key={line.product_id}>
                                            <TableCell className="font-medium">{line.product_name}</TableCell>
                                            <TableCell className="text-center">{line.quantity}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={processed > 0 ? "success" : "outline"}>{processed}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={pending > 0 ? "warning" : "outline"}>{pending}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={processQuantities[line.product_id] || 0}
                                                    onChange={(e) => handleQuantityChange(line.product_id, e.target.value, pending)}
                                                    disabled={pending <= 0}
                                                    className="text-center"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-2">
                        <Label>Notas</Label>
                        <Input placeholder="Ej: Devolución parcial por daño..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </div>
            )}
        </BaseModal>
    )
}
