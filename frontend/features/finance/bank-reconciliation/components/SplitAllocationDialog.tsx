"use client"

import { useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { useAllocateMutation } from "../hooks/useReconciliationMutations"
import type { ReconciliationSystemItem } from "../types"
import api from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { z } from "zod"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { isZeroTolerance, safeDifference, safeSum, safeParseFloat } from "@/lib/math"

const allocationSchema = z.object({
    allocations: z.array(z.object({
        invoice: z.number().optional(),
        notes: z.string().optional(),
        amount: z.number()
    }))
})

type AllocationFormValues = z.infer<typeof allocationSchema>

interface SplitAllocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payment: ReconciliationSystemItem | null
    treasuryAccountId?: number
    onSuccess?: () => void
}

export function SplitAllocationDialog({ open, onOpenChange, payment, treasuryAccountId, onSuccess }: SplitAllocationDialogProps) {
    const allocateMutation = useAllocateMutation(payment?.id || 0, treasuryAccountId)

    const form = useForm<AllocationFormValues>({
        resolver: zodResolver(allocationSchema),
        defaultValues: {
            allocations: []
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "allocations"
    })

    const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
        queryKey: ['billing', 'pending-invoices'],
        queryFn: async () => {
            const res = await api.get('/billing/invoices/?status=DRAFT,ISSUED,AUTHORIZED')
            return res.data.results || res.data
        },
        enabled: open && !!payment
    })

    useEffect(() => {
        if (open && payment && fields.length === 0) {
            form.reset({
                allocations: [{ 
                    amount: Math.abs(safeParseFloat(payment.amount)), 
                    notes: '' 
                }]
            })
        }
    }, [open, payment, fields.length, form])

    if (!payment) return null

    const totalPayment = Math.abs(safeParseFloat(payment.amount))
    const watchedAllocations = form.watch("allocations")
    const currentSum = safeSum(watchedAllocations.map(a => safeParseFloat(a.amount)))
    const remaining = safeDifference(totalPayment, currentSum)

    const handleSave = async (validateSum: boolean) => {
        const values = form.getValues()
        try {
            await allocateMutation.mutateAsync({ 
                allocations: values.allocations, 
                validateSum 
            })
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
            <Form {...form}>
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
                            <p className={`text-xl font-bold font-mono ${isZeroTolerance(remaining) ? 'text-success' : (remaining < 0 ? 'text-destructive' : 'text-warning')}`}>
                                {formatCurrency(remaining)}
                            </p>
                        </div>
                    </div>

                    <div className="border rounded-md">
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
                                {fields.map((field, idx) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`allocations.${idx}.invoice`}
                                                render={({ field: selectField }) => (
                                                    <FormItem>
                                                        <Select
                                                            value={selectField.value ? String(selectField.value) : undefined}
                                                            onValueChange={(val) => selectField.onChange(parseInt(val))}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8 text-xs">
                                                                    <SelectValue placeholder={loadingInvoices ? "Cargando..." : "Seleccionar"} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {invoices.map((inv: any) => (
                                                                    <SelectItem key={inv.id} value={String(inv.id)}>
                                                                        {inv.display_id} - {inv.contact_name} - {formatCurrency(safeParseFloat(inv.total))}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`allocations.${idx}.notes`}
                                                render={({ field: inputField }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input
                                                                {...inputField}
                                                                className="h-8 text-xs"
                                                                placeholder="Notas opcionales..."
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`allocations.${idx}.amount`}
                                                render={({ field: inputField }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input
                                                                {...inputField}
                                                                className="h-8 font-mono text-right text-xs"
                                                                type="number"
                                                                step="0.01"
                                                                onChange={(e) => inputField.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                                                onClick={() => remove(idx)}
                                                type="button"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => append({ amount: remaining > 0 ? remaining : 0, notes: '' })} 
                        className="w-full border-dashed"
                        type="button"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Agregar Distribución
                    </Button>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
                        <Button 
                            variant="secondary" 
                            onClick={() => handleSave(false)}
                            disabled={allocateMutation.isPending || fields.length === 0}
                            type="button"
                        >
                            Guardar Borrador
                        </Button>
                        <Button 
                            onClick={() => handleSave(true)}
                            disabled={allocateMutation.isPending || !isZeroTolerance(remaining) || fields.length === 0}
                            className="bg-primary hover:bg-primary/90"
                            type="button"
                        >
                            {allocateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Finalizar Distribución
                        </Button>
                    </div>
                </div>
            </Form>
        </BaseModal>
    )
}
