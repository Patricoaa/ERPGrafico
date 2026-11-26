"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { BaseModal, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell, SubmitButton } from '@/components/shared'
import { EditableCollection, editableSchema, toEditableErrors, type EditableRowValue } from "@/components/entity-view"
import { noteLogisticsLinesEditable, toNoteLogisticsLines, type NoteInvoiceLine } from "../entity-view/noteLogisticsLine.entity"
import { toast } from "sonner"
import { useProcessLogistics } from "../hooks/useOrdersMutations"
import { useNoteLogisticsData } from "../hooks/useNoteLogisticsData"

import { useServerDate } from "@/hooks/useServerDate"

import { type Order } from "../types"

interface NoteLogisticsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoice: Order
    onSuccess?: () => void
}

export function NoteLogisticsModal({ open, onOpenChange, invoice, onSuccess }: NoteLogisticsModalProps) {
    const { dateString } = useServerDate()
    const { processLogistics } = useProcessLogistics()
    const { warehouses, invoice: freshInvoice, isLoading } = useNoteLogisticsData(invoice?.id ?? null, open && !!invoice)
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [processQuantities, setProcessQuantities] = useState<{ [pId: number]: number }>({})
    const [displayLines, setDisplayLines] = useState<NoteInvoiceLine[]>((invoice?.lines as unknown as NoteInvoiceLine[]) || [])
    const [date, setDate] = useState("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // Sync date with server date
    useEffect(() => {
        if (dateString && !date) {
            requestAnimationFrame(() => setDate(dateString))
        }
    }, [dateString])

    const [prevFreshInvoice, setPrevFreshInvoice] = useState<unknown>(null)

    const isSale = !!invoice?.sale_order || !!(invoice as Record<string, unknown>)?.['sale_order_number']
    const isCredit = invoice?.dte_type === 'NOTA_CREDITO'

    // Initialize from hook data when it loads
    if (freshInvoice && freshInvoice !== prevFreshInvoice) {
        setPrevFreshInvoice(freshInvoice)
        const freshLines = ((freshInvoice as Record<string, unknown>).lines || []) as NoteInvoiceLine[]
        setDisplayLines(freshLines)
        setProcessQuantities(Object.fromEntries(toNoteLogisticsLines(freshLines, isSale).map((l) => [l.product_id, l.pending])))

        if (warehouses.length > 0 && !selectedWarehouse) {
            setSelectedWarehouse(warehouses[0].id as number)
        }
    }

    const lines = useMemo(() => toNoteLogisticsLines(displayLines, isSale), [displayLines, isSale])
    const quantityValue: EditableRowValue[] = lines.map((l) => ({ key: String(l.product_id), values: { toProcess: processQuantities[l.product_id] ?? 0 } }))
    const parsedQuantities = editableSchema(noteLogisticsLinesEditable, lines).safeParse(quantityValue)
    // "At least one" stays the submit toast below; the cell errors are the caps.
    const quantityErrors = parsedQuantities.success ? {} : toEditableErrors(parsedQuantities.error, quantityValue)

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

        if (Object.keys(quantityErrors).length > 0) {
            toast.error("Hay cantidades que superan lo pendiente")
            return
        }

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
                    <SubmitButton loading={submitting} onClick={handleSubmit} disabled={isLoading}>
                        Confirmar Movimiento
                    </SubmitButton>
                </>
            }
        >
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando datos del documento">
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

                    <EditableCollection
                        definition={noteLogisticsLinesEditable}
                        rows={lines}
                        value={quantityValue}
                        onChange={(next) => setProcessQuantities(Object.fromEntries(next.map((v) => [Number(v.key), v.values.toProcess ?? 0])))}
                        errors={quantityErrors}
                        label="Cantidades a procesar"
                    />

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
