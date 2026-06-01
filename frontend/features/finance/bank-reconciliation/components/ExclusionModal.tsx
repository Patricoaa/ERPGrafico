"use client"

import { useEffect } from "react"

import {AlertCircle} from "lucide-react"
import { z } from "zod"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BaseModal, CancelButton, DangerButton, FormFooter, LabeledInput, LabeledSelect } from '@/components/shared'

const exclusionSchema = z.object({
    reason: z.string().min(1, "Debes seleccionar un motivo"),
    notes: z.string().optional()
})

type ExclusionFormValues = z.infer<typeof exclusionSchema>

interface ExclusionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason: string, notes: string) => Promise<void>
    title?: string
}

export function ExclusionModal({
    open,
    onOpenChange,
    onConfirm,
    title = "Excluir Movimiento"
}: ExclusionModalProps) {
    
    const form = useForm<ExclusionFormValues>({
        resolver: zodResolver(exclusionSchema),
        defaultValues: {
            reason: "DUPLICATE",
            notes: ""
        }
    })

    const { isSubmitting } = form.formState

    useEffect(() => {
        if (open) {
            form.reset({ reason: "DUPLICATE", notes: "" })
        }
    }, [open, form])

    const onSubmit = async (data: ExclusionFormValues) => {
        try {
            await onConfirm(data.reason, data.notes || "")
            onOpenChange(false)
        } catch {
            // Handled in mutation
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xs"
            icon={AlertCircle}
            title={title}
            description="Tesorería • Exclusión de Movimiento"
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={isSubmitting} />
                            <DangerButton onClick={form.handleSubmit(onSubmit)} loading={isSubmitting}>
                                Confirmar Exclusión
                            </DangerButton>
                        </>
                    }
                />
            }
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed opacity-80">
                    El movimiento se ocultará de la conciliación activa. La justificación es obligatoria para fines de auditoría.
                </p>

                <Controller
                    control={form.control}
                    name="reason"
                    render={({ field, fieldState }) => (
                        <LabeledSelect
                            label="Motivo de Exclusión"
                            required
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldState.error?.message}
                            options={[
                                { value: "DUPLICATE", label: "Transacción Duplicada" },
                                { value: "INTERNAL",  label: "Traspaso Interno" },
                                { value: "ADJUSTMENT", label: "Ajuste de Saldo" },
                                { value: "ERROR",     label: "Error de Importación" },
                                { value: "OTHER",     label: "Otro (Especificar)" },
                            ]}
                        />
                    )}
                />

                <Controller
                    control={form.control}
                    name="notes"
                    render={({ field, fieldState }) => (
                        <LabeledInput
                            label="Notas Adicionales"
                            as="textarea"
                            rows={3}
                            placeholder="Detalla por qué excluyes este movimiento..."
                            error={fieldState.error?.message}
                            {...field}
                        />
                    )}
                />
            </form>
        </BaseModal>
    )
}
