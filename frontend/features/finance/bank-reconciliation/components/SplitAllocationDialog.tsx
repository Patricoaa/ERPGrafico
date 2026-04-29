"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, SplitSquareHorizontal, CheckCircle2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { useAllocateMutation } from "../hooks/useReconciliationMutations"
import type { ReconciliationSystemItem, PaymentAllocationPayload } from "../types"
import api from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SplitAllocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payment: ReconciliationSystemItem | null
    treasuryAccountId?: number
    onSuccess?: () => void
}

export function SplitAllocationDialog({ open, onOpenChange, payment, treasuryAccountId, onSuccess }: SplitAllocationDialogProps) {
    const [allocations, setAllocations] = useState<PaymentAllocationPayload[]>([])
    const allocateMutation = useAllocateMutation(payment?.id || 0, treasuryAccountId)
    const [invoices, setInvoices] = useState<any[]>([])

    // Load available invoices for the contact
    useEffect(() => {
        if (open && payment) {
            // First time we open the dialog, initialize one empty slice
            if (allocations.length === 0) {
                setAllocations([{ amount: Math.abs(parseFloat(payment.amount)), notes: '' }])
            }
            // In a real scenario we'd query pending invoices that match payment.contact_id
            api.get('/billing/invoices/?status=DRAFT,ISSUED,AUTHORIZED')
                .then(res => setInvoices(res.data.results || res.data))
                .catch(() => {})
        }
    }, [open, payment])

    if (!payment) return null

    const totalPayment = Math.abs(parseFloat(payment.amount))
    const currentSum = allocations.reduce((acc, row) => acc + (parseFloat(row.amount as string) || 0), 0)
    const remaining = totalPayment - currentSum

    const addAllocationRow = () => {
        setAllocations([...allocations, { amount: remaining > 0 ? remaining : 0, notes: '' }])
    }

    const removeRow = (index: number) => {
        setAllocations(allocations.filter((_, i) => i !== index))
    }

    const updateRow = (index: number, field: keyof PaymentAllocationPayload, value: any) => {
        const newAlloc = [...allocations]
        newAlloc[index] = { ...newAlloc[index], [field]: value }
        setAllocations(newAlloc)
    }

    const handleSave = async (validateSum: boolean) => {
        try {
            await allocateMutation.mutateAsync({ allocations, validateSum })
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            // Handled in mutation
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Distribuir Movimiento"
            description={`Distribuir monto del pago ${payment.display_id || payment.code || 'PEND'} entre múltiples documentos.`}
        >
            <div className="space-y-6 max-w-3xl mx-auto">
                <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-border/50">
                    <div>
                        <p className="text-xs font-black uppercase text-muted-foreground">Monto Total a Distribuir</p>
                        <p className="text-xl font-bold font-mono">{formatCurrency(totalPayment)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-black uppercase text-muted-foreground">Suma Asignada</p>
                        <p className="text-xl font-bold font-mono text-primary">{formatCurrency(currentSum)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-black uppercase text-muted-foreground">Diferencia</p>
                        <p className={`text-xl font-bold font-mono ${remaining === 0 ? 'text-success' : (remaining < 0 ? 'text-destructive' : 'text-warning')}`}>
                            {formatCurrency(remaining)}
                        </p>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%]">Factura/Documento</TableHead>
                            <TableHead className="w-[40%]">Notas</TableHead>
                            <TableHead className="w-[20%] text-right">Monto</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allocations.map((row, idx) => (
                            <TableRow key={idx}>
                                <TableCell>
                                    <Select
                                        value={row.invoice ? String(row.invoice) : undefined}
                                        onValueChange={(val) => updateRow(idx, 'invoice', parseInt(val))}
                                    >
                                        <SelectTrigger className="w-full h-8 text-xs">
                                            <SelectValue placeholder="Seleccionar Documento" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {invoices.map(inv => (
                                                <SelectItem key={inv.id} value={String(inv.id)}>
                                                    {inv.display_id} - {inv.contact_name} - {formatCurrency(parseFloat(inv.total))}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        className="h-8 text-xs"
                                        placeholder="Notas opcionales..."
                                        value={row.notes || ''}
                                        onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        className="h-8 font-mono text-right text-xs"
                                        type="number"
                                        value={row.amount}
                                        onChange={(e) => updateRow(idx, 'amount', e.target.value)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeRow(idx)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Button variant="outline" size="sm" onClick={addAllocationRow} className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" /> Agregar Distribución
                </Button>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => handleSave(false)}
                        disabled={allocateMutation.isPending || allocations.length === 0}
                    >
                        Guardar Borrador
                    </Button>
                    <Button 
                        onClick={() => handleSave(true)}
                        disabled={allocateMutation.isPending || Math.abs(remaining) > 0.01 || allocations.length === 0}
                        className="bg-primary hover:bg-primary/90"
                    >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar Distribución
                    </Button>
                </div>
            </div>
        </BaseModal>
    )
}
