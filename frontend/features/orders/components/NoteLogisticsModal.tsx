"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BaseModal, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell } from '@/components/shared'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Chip } from "@/components/shared"
import { toast } from "sonner"
import { ordersApi, useProcessLogistics } from "../hooks/useOrdersMutations"
import {Loader2} from "lucide-react"
import { useServerDate } from "@/hooks/useServerDate"

import { type Order } from "../types"

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
    invoice: Order
    onSuccess?: () => void
}

export function NoteLogisticsModal({ open, onOpenChange, invoice, onSuccess }: NoteLogisticsModalProps) {
    const { dateString } = useServerDate()
    const { processLogistics } = useProcessLogistics()
    const [warehouses, setWarehouses] = useState<Record<string, unknown>[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [processQuantities, setProcessQuantities] = useState<{ [pId: number]: number }>({})
    const [displayLines, setDisplayLines] = useState<InvoiceLine[]>((invoice?.lines as unknown as InvoiceLine[]) || [])
    const [date, setDate] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Sync date with server date
    useEffect(() => {
        if (dateString && !date) {
            requestAnimationFrame(() => setDate(dateString))
        }
    }, [dateString])

    const isSale = !!invoice?.sale_order || !!(invoice as Record<string, unknown>)?.['sale_order_number']
    const isCredit = invoice?.dte_type === 'NOTA_CREDITO'
    // const lines = invoice?.lines || [] // REMOVED: Use displayLines instead

    const fetchData = async () => {
        setLoading(true)
        try {
            const warehousesList = await ordersApi.getWarehouses() as Record<string, unknown>[]
            setWarehouses(warehousesList)

            if (warehousesList.length > 0) {
                setSelectedWarehouse(warehousesList[0].id as number)
            }

            const freshInvoice = await ordersApi.getInvoice(invoice.id) as Record<string, unknown>
            const freshLines = (freshInvoice.lines || []) as InvoiceLine[]

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

    useEffect(() => {
        if (open && invoice) {
            requestAnimationFrame(() => {
                // Reset display lines to props initially while loading fresh data
                setDisplayLines((invoice.lines as unknown as InvoiceLine[]) || [])
                fetchData()
            })
        }
    }, [open, invoice])

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
            .filter(([, qty]) => qty > 0)
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
            await processLogistics({
                id: invoice.id,
                data: {
                    warehouse_id: selectedWarehouse,
                    date: date,
                    line_data: lineData,
                    notes: notes
                }
            })

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
            <SkeletonShell isLoading={loading} ariaLabel="Cargando datos del documento">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledSelect
                            label="Bodega"
                            value={selectedWarehouse?.toString() || ""}
                            onChange={(val) => setSelectedWarehouse(Number(val))}
                            options={warehouses.map((w: Record<string, unknown>) => ({ value: (w.id as number).toString(), label: `${w.name as string} (${w.code as string})` }))}
                        />
                        <PeriodValidationDateInput
                            label="Fecha"
                            date={date ? new Date(date + 'T12:00:00') : undefined}
                            onDateChange={(d) => {
                                if (!d) {
                                    setDate("")
                                    return
                                }
                                setDate(d.toISOString().split('T')[0])
                            }}
                            validationType="accounting"
                        />
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-center">Cantidad Nota</TableHead>
                                    <TableHead className="text-center">Procesado</TableHead>
                                    <TableHead className="text-center">Pendiente</TableHead>
                                    <TableHead className="text-center w-32">A Procesar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayLines.map((line: InvoiceLine) => {
                                    const processed = isSale ? (line.quantity_delivered || 0) : (line.quantity_received || 0)
                                    const pending = Math.max(0, line.quantity - processed)

                                    return (
                                        <TableRow key={line.product_id}>
                                            <TableCell className="font-medium">{line.product_name}</TableCell>
                                            <TableCell className="text-center">{line.quantity}</TableCell>
                                            <TableCell className="text-center">
                                                <Chip.Count value={processed} hideOnZero={false} intent="success" />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Chip.Count value={pending} hideOnZero={false} intent="warning" />
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

                    <LabeledInput
                        label="Notas"
                        placeholder="Ej: Devolución parcial por daño..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </SkeletonShell>
        </BaseModal>
    )
}
