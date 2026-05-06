"use client"

import { useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { z } from "zod"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LabeledSelect, LabeledInput } from "@/components/shared"

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
        } catch (error) {
            // Handled in mutation
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xs"
            title={
                <div className="flex items-center gap-3 py-1">
                    <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-black uppercase tracking-tight">{title}</span>
                </div>
            }
            footer={
                <div className="flex gap-2 w-full justify-end">
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSubmitting} 
                        className="text-xs font-bold uppercase"
                    >
                        Cancelar
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="font-black uppercase tracking-widest px-6 text-xs"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Exclusión"}
                    </Button>
                </div>
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
