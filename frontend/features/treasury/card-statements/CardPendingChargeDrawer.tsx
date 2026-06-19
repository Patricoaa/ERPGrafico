"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { DollarSign, Tag, Pencil, Trash2 } from "lucide-react"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { useServerDate } from "@/hooks/useServerDate"
import { Form, FormField } from "@/components/ui/form"
import {
    CancelButton, LabeledInput, FormSection, FormFooter,
    FormSplitLayout, ActionSlideButton, Drawer, SkeletonShell,
} from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { showApiError } from "@/lib/errors"
import { toast } from 'sonner'
import { treasuryApi } from '../api/treasuryApi'
import type { PendingChargeRow } from '../types'

const CHARGE_TYPES = [
    { value: 'COMMISSION', label: 'Comisión' },
    { value: 'TAX', label: 'Impuesto' },
    { value: 'FEE', label: 'Cargo' },
    { value: 'INSURANCE', label: 'Seguro' },
    { value: 'INTEREST', label: 'Interés' },
    { value: 'OTHER', label: 'Otro' },
]

const chargeSchema = z.object({
    amount: z.string().refine(
        (val) => !isNaN(Number(val)) && Number(val) > 0,
        "El monto debe ser mayor a 0",
    ),
    charge_type: z.string().min(1, "Seleccione un tipo de cargo"),
    date: z.string().min(1, "La fecha es requerida"),
    description: z.string().optional(),
})

type ChargeFormValues = z.infer<typeof chargeSchema>

interface CardPendingChargeDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cardAccountId: number
    cardAccountName: string
    currency?: string
    charge?: PendingChargeRow | null
    onSuccess?: () => void
    mode?: DrawerMode
}

export function CardPendingChargeDrawer({
    open,
    onOpenChange,
    cardAccountId,
    cardAccountName,
    currency = 'CLP',
    charge,
    onSuccess,
    mode: modeProp,
}: CardPendingChargeDrawerProps) {
    const { serverDate, isLoading: isServerDateLoading } = useServerDate()
    const mode: DrawerMode = modeProp ?? (charge ? 'edit' : 'create')
    const isView = mode === 'view'
    const [loading, setLoading] = useState(false)

    const form = useForm<ChargeFormValues>({
        resolver: zodResolver(chargeSchema),
        defaultValues: {
            amount: "",
            charge_type: "OTHER",
            date: "",
            description: "",
        },
    })

    useEffect(() => {
        if (!open) return
        if (charge) {
            form.reset({
                amount: String(Number(charge.amount)),
                charge_type: charge.charge_type || 'OTHER',
                date: charge.date?.split('T')[0] ?? '',
                description: charge.description ?? '',
            })
        } else {
            form.reset({
                amount: "",
                charge_type: "OTHER",
                date: serverDate ? serverDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                description: "",
            })
        }
    }, [open, charge, form, serverDate])

    const onSubmit = async (values: ChargeFormValues) => {
        try {
            setLoading(true)
            if (charge) {
                await treasuryApi.updateUnbilledCharge({
                    id: charge.id,
                    amount: values.amount,
                    charge_type: values.charge_type,
                    description: values.description,
                    date: values.date,
                })
                toast.success('Cargo actualizado exitosamente')
            } else {
                await treasuryApi.addUnbilledCharge({
                    card_account: cardAccountId,
                    amount: values.amount,
                    charge_type: values.charge_type,
                    description: values.description,
                    date: values.date,
                })
                toast.success('Cargo agregado exitosamente')
            }
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            showApiError(error, 'Error al guardar el cargo')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!charge) return
        try {
            setLoading(true)
            await treasuryApi.deleteUnbilledCharge(charge.id)
            toast.success('Cargo eliminado exitosamente')
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            showApiError(error, 'Error al eliminar el cargo')
        } finally {
            setLoading(false)
        }
    }

    const drawerTitle = isView ? "Detalle del Cargo" : charge ? "Editar Cargo" : "Agregar Cargo No Facturado"

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("simple", false)}
            mode={mode}
            title={drawerTitle}
            subtitle={`${charge ? 'Editar' : 'Nuevo'} cargo en ${cardAccountName}`}
            footer={isView ? undefined : (
                <FormFooter
                    actions={
                        <>
                            {charge && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Eliminar
                                </Button>
                            )}
                            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                            <ActionSlideButton
                                loading={loading}
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={loading}
                            >
                                {charge ? "Guardar Cambios" : "Agregar Cargo"}
                            </ActionSlideButton>
                        </>
                    }
                />
            )}
        >
            <SkeletonShell isLoading={isServerDateLoading} ariaLabel="Cargando formulario">
                <FormSplitLayout>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
                                <div className="space-y-4">
                                    <FormSection title="Detalles del Cargo" icon={Tag} />

                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Monto"
                                                type="number"
                                                step="0.01"
                                                icon={<DollarSign className="h-4 w-4 opacity-40" />}
                                                placeholder="0.00"
                                                required
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="charge_type"
                                        render={({ field }) => (
                                            <div className="grid gap-2">
                                                <Label htmlFor="charge_type">Tipo de Cargo</Label>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger id="charge_type">
                                                        <SelectValue placeholder="Seleccionar tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {CHARGE_TYPES.map((type) => (
                                                            <SelectItem key={type.value} value={type.value}>
                                                                {type.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field, fieldState }) => (
                                            <div className="grid gap-2">
                                                <Label htmlFor="date">Fecha</Label>
                                                <Input
                                                    id="date"
                                                    type="date"
                                                    required
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <p className="text-sm text-destructive">{fieldState.error.message}</p>
                                                )}
                                            </div>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <div className="grid gap-2">
                                                <Label htmlFor="description">Descripción</Label>
                                                <Textarea
                                                    id="description"
                                                    placeholder="Descripción del cargo"
                                                    {...field}
                                                />
                                            </div>
                                        )}
                                    />
                                </div>
                            </fieldset>
                        </form>
                    </Form>
                </FormSplitLayout>
            </SkeletonShell>
        </Drawer>
    )
}
