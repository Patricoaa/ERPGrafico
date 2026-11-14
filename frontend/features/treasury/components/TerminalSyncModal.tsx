"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { RefreshCw } from "lucide-react"
import { parseISO } from "date-fns"
import { BaseModal, FormFooter, CancelButton, SubmitButton, LabeledContainer, DatePicker } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { getFieldErrorMessage } from "@/lib/errors"
import { toDateOnlyISO } from "@/lib/utils"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useStartTerminalSync } from "../hooks/useTerminalSync"
import { terminalSyncSchema, toManualSyncPayload, type TerminalSyncFormValues } from "./TerminalSyncModal.schema"

interface TerminalSyncModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const EMPTY: TerminalSyncFormValues = { start_date: "", end_date: "" }
const FIELDS = ["start_date", "end_date"] as const

/**
 * "Sincronizar ahora": encola una sincronización manual de ventas TUU. Ambas fechas son opcionales; vacías,
 * el backend usa la fecha de inicio del historial o los días hacia atrás configurados.
 */
export function TerminalSyncModal({ open, onOpenChange }: TerminalSyncModalProps) {
    const { startSync, isStarting } = useStartTerminalSync()
    const form = useForm<TerminalSyncFormValues>({
        resolver: zodResolver(terminalSyncSchema),
        defaultValues: EMPTY,
    })

    useInitializeDrawerForm({ form, open, initialData: null, defaultValues: EMPTY })

    const onSubmit = async (values: TerminalSyncFormValues) => {
        try {
            await startSync(toManualSyncPayload(values))
            onOpenChange(false)
        } catch (error: unknown) {
            // The hook already toasts the error; surface field validation next to its input.
            for (const field of FIELDS) {
                const message = getFieldErrorMessage(error, field)
                if (message) form.setError(field, { message })
            }
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={
                <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    <span>Sincronizar ventas</span>
                </div>
            }
            description="Trae las ventas de los proveedores TUU para el rango indicado. Deje las fechas vacías para usar el rango configurado."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton type="submit" form="terminal-sync-form" loading={isStarting} disabled={isStarting}>
                                Sincronizar
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form id="terminal-sync-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field, fieldState }) => (
                            <LabeledContainer label="Fecha inicial" error={fieldState.error?.message}>
                                <DatePicker
                                    date={field.value ? parseISO(field.value) : undefined}
                                    onDateChange={(d) => field.onChange(d ? toDateOnlyISO(d) : "")}
                                    placeholder="Rango configurado"
                                    className="w-full border-none bg-transparent hover:bg-transparent shadow-none"
                                />
                            </LabeledContainer>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field, fieldState }) => (
                            <LabeledContainer label="Fecha final" error={fieldState.error?.message}>
                                <DatePicker
                                    date={field.value ? parseISO(field.value) : undefined}
                                    onDateChange={(d) => field.onChange(d ? toDateOnlyISO(d) : "")}
                                    placeholder="Hoy"
                                    className="w-full border-none bg-transparent hover:bg-transparent shadow-none"
                                />
                            </LabeledContainer>
                        )}
                    />
                </form>
            </Form>
        </BaseModal>
    )
}

export default TerminalSyncModal
