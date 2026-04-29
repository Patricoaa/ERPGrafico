"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { BaseModal } from "@/components/shared/BaseModal"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { CancelButton, LabeledInput, FormFooter, LabeledCheckbox } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { UserCog } from "lucide-react"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

const partnerSetupSchema = z.object({
    is_partner: z.boolean(),
    partner_equity_percentage: z.string().optional(),
    // Normally you'd have an account selector here. For simplicity, we just allow the percentage and boolean for now, 
    // or you could add partner_account_id if you have an AccountSelector component.
})

type SetupValues = z.infer<typeof partnerSetupSchema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact: any | null
    onSuccess: () => void
}

export function PartnerEditModal({ open, onOpenChange, contact, onSuccess }: Props) {
    const [submitting, setSubmitting] = useState(false)

    const form = useForm<SetupValues>({
        resolver: zodResolver(partnerSetupSchema),
        defaultValues: {
            is_partner: true,
            partner_equity_percentage: "",
        }
    })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }
        if (!contact) return

        const currentId = contact.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            form.reset({
                is_partner: contact.is_partner ?? true,
                partner_equity_percentage: contact.partner_equity_percentage?.toString() || "",
            })
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, contact, form])

    const onSubmit = async (data: SetupValues) => {
        if (!contact) return
        setSubmitting(true)
        try {
            await partnersApi.setupPartner(contact.id, {
                is_partner: data.is_partner,
                partner_equity_percentage: data.partner_equity_percentage ? parseFloat(data.partner_equity_percentage) : undefined,
            })
            toast.success("Configuración de socio actualizada")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al actualizar")
        } finally {
            setSubmitting(false)
        }
    }

    if (!contact) return null

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={
                <div className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-primary" />
                    Editar Socio
                </div>
            }
            description={`Ajuste la participación de ${contact.name}.`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <ActionSlideButton type="submit" form="partner-edit-form" loading={submitting} className="font-bold">
                                Guardar Cambios
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >

            <Form {...form}>
                <form id="partner-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

                    <FormField
                        control={form.control}
                        name="is_partner"
                        render={({ field }) => (
                            <LabeledCheckbox
                                label="Configuración de Socio"
                                description="Es Socio de la Empresa"
                                hint="Habilita o deshabilita a este contacto del módulo societario. Al desmarcar, desaparecerá de la lista."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="partner_equity_percentage"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Porcentaje de Participación (%)"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="Ej: 33.33"
                                hint="Deje en blanco si no aplica."
                                error={fieldState.error?.message}
                                {...field}
                                disabled={!form.watch('is_partner')}
                            />
                        )}
                    />
                </form>
            </Form>
        </BaseModal>
    )
}
