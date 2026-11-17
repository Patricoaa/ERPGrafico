"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Download } from "lucide-react"
import { BaseModal, FormFooter, CancelButton, SubmitButton, LabeledSelect, LabeledCheckbox } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useStartRcvImport } from "../../hooks/useRcvImports"
import { RCV_MONTH_NAMES, rcvYearOptions } from "../../unifiedSearchDef"
import type { RcvDirection } from "../../types"
import {
    defaultRcvImportValues,
    rcvImportSchema,
    toStartRcvImportPayload,
    type RcvImportFormValues,
} from "./RcvImportModal.schema"

interface RcvImportModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Direcciones marcadas al abrir; por defecto, ambas. */
    defaultDirections?: readonly RcvDirection[]
}

const MONTH_OPTIONS = RCV_MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) }))

const DIRECTION_CHOICES: { value: RcvDirection; label: string; description: string }[] = [
    { value: "PURCHASES", label: "Compras", description: "Registro de compras del período" },
    { value: "SALES", label: "Ventas", description: "Registro de ventas del período" },
]

/**
 * "Importar ahora": encola una importación manual del RCV del SII para un período y una o ambas direcciones.
 * Por defecto propone el mes de (hoy − 3 días), igual que la importación automática.
 */
export function RcvImportModal({ open, onOpenChange, defaultDirections }: RcvImportModalProps) {
    const { startImport, isStarting } = useStartRcvImport()
    const form = useForm<RcvImportFormValues>({
        resolver: zodResolver(rcvImportSchema),
        defaultValues: defaultRcvImportValues(new Date(), defaultDirections),
    })

    useInitializeDrawerForm({ form, open, initialData: null, defaultValues: () => defaultRcvImportValues(new Date(), defaultDirections) })

    const onSubmit = async (values: RcvImportFormValues) => {
        try {
            await startImport(toStartRcvImportPayload(values))
            onOpenChange(false)
        } catch {
            // The hook already toasts the error; the modal stays open so the user can retry.
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={
                <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <span>Importar RCV</span>
                </div>
            }
            description="Trae del SII el registro de compras y ventas del período indicado. Cada dirección consume una consulta de las API keys."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton type="submit" form="rcv-import-form" loading={isStarting} disabled={isStarting}>
                                Importar
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form id="rcv-import-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="month"
                        render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Mes"
                                options={MONTH_OPTIONS}
                                value={String(field.value)}
                                onChange={(v) => field.onChange(Number(v))}
                                error={fieldState.error?.message}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="year"
                        render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Año"
                                options={rcvYearOptions()}
                                value={String(field.value)}
                                onChange={(v) => field.onChange(Number(v))}
                                error={fieldState.error?.message}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="directions"
                        render={({ field, fieldState }) => (
                            <div className="space-y-2 sm:col-span-2">
                                {DIRECTION_CHOICES.map((choice) => (
                                    <LabeledCheckbox
                                        key={choice.value}
                                        label={choice.label}
                                        description={choice.description}
                                        checked={field.value.includes(choice.value)}
                                        onCheckedChange={(checked) =>
                                            field.onChange(
                                                checked
                                                    ? [...field.value.filter((d) => d !== choice.value), choice.value]
                                                    : field.value.filter((d) => d !== choice.value),
                                            )
                                        }
                                    />
                                ))}
                                {fieldState.error?.message && (
                                    <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>
                                )}
                            </div>
                        )}
                    />
                </form>
            </Form>
        </BaseModal>
    )
}

export default RcvImportModal
