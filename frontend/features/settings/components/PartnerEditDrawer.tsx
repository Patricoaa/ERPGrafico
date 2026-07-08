"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Drawer, CancelButton, LabeledInput, FormFooter, LabeledCheckbox, ActionSlideButton } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import {Form, FormField} from "@/components/ui/form"

import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared"
import { partnersApi } from "@/features/contacts"
import type { Contact } from "@/types/entities"

const partnerSetupSchema = z.object({
    is_partner: z.boolean(),
    partner_equity_percentage: z.string().optional(),
    // Normally you'd have an account selector here. For simplicity, we just allow the percentage and boolean for now, 
    // or you could add partner_account_id if you have an AccountSelector component.
})

type SetupValues = z.infer<typeof partnerSetupSchema>

interface PartnerEditDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact: (Contact & { is_partner?: boolean; partner_equity_percentage?: number }) | null
    onSuccess: () => void
    mode?: DrawerMode
}

export function PartnerEditDrawer({ open, onOpenChange, contact, onSuccess, mode: modeProp }: PartnerEditDrawerProps) {
    const mode: DrawerMode = modeProp ?? (contact ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })
    const [submitting, setSubmitting] = useState(false)

    const formValues = contact ? {
        is_partner: contact.is_partner ?? true,
        partner_equity_percentage: contact.partner_equity_percentage?.toString() || "",
    } : { is_partner: true, partner_equity_percentage: "" }

    const form = useForm<SetupValues>({
        resolver: zodResolver(partnerSetupSchema),
        defaultValues: {
            is_partner: true,
            partner_equity_percentage: "",
        },
        values: formValues,
    })

    const isPartner = useWatch({ control: form.control, name: 'is_partner' })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (open) {
            wasOpen.current = true
        } else {
            wasOpen.current = false
        }
    }, [open])

    useEffect(() => {
        if (contact) {
            lastResetId.current = contact.id
        }
    }, [contact])

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

    const identity = useDrawerIdentity('settings.partner', mode, contact, {
        overrideSubtitle: `Ajuste la participación de ${contact?.name}.`,
        printable: (mode === 'view' || mode === 'edit') && !!contact?.id,
        onPrint: handlePrint,
    })

    if (!contact) return null

    return (
        <>
            {(mode === 'view' || mode === 'edit') && contact?.id && (
                <PrintableLayout ref={printRef} title="Socio" displayId={`#${contact.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{contact?.name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("simple", true)}
                mode={mode}
                title={identity.title}
                icon={identity.icon}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
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
                )}
            >
                <Form {...form}>
                    <form id="partner-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <fieldset disabled={isView} className="contents">

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
                                    disabled={!isPartner}
                                />
                            )}
                        />
                        </fieldset>
                    </form>
                </Form>
            </Drawer>
        </>
    )
}
