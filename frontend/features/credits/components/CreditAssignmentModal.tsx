"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    AlertCircle,
    Banknote,
    TrendingUp,
} from "lucide-react"
import {
    Form,
    FormField,
    FormItem,
} from "@/components/ui/form"
import { LabeledInput, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { BaseModal } from "@/components/shared/BaseModal"
import { useContactMutations } from "@/features/contacts/hooks/useContacts"
import { CreditContact } from '@/features/credits/api/creditsApi'
import { AdvancedContactSelector } from "@/components/selectors"
import { Contact } from "@/types/entities"

const creditSchema = z.object({
    credit_limit: z.coerce.number().min(0, "El límite debe ser mayor o igual a 0").nullable(),
})

interface CreditAssignmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: CreditContact | null
    onSuccess?: () => void
}

export default function CreditAssignmentModal({
    open,
    onOpenChange,
    contact: initialContact,
    onSuccess
}: CreditAssignmentModalProps) {
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const { updateContact, isUpdating } = useContactMutations()

    const form = useForm<z.infer<typeof creditSchema>>({
        resolver: zodResolver(creditSchema),
        defaultValues: {
            credit_limit: null,
        },
    })

    useEffect(() => {
        if (open) {
            if (initialContact) {
                setSelectedContact(initialContact as unknown as Contact)
                form.reset({
                    credit_limit: initialContact.credit_limit ? Number(initialContact.credit_limit) : null
                })
            } else {
                setSelectedContact(null)
                form.reset({ credit_limit: null })
            }
        }
    }, [open, initialContact, form])

    const onSubmit = async (values: z.infer<typeof creditSchema>) => {
        const currentContact = selectedContact || (initialContact as unknown as Contact)
        if (!currentContact) return

        try {
            await updateContact({
                id: currentContact.id,
                payload: {
                    credit_enabled: (values.credit_limit || 0) > 0,
                    credit_limit: values.credit_limit,
                }
            })
            onOpenChange(false)
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error("Error updating credit limit:", error)
        }
    }

    const fmt = (val: number | string) => Number(val).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

    const activeContact = selectedContact || (initialContact as unknown as Contact)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={initialContact ? "Editar Línea de Crédito" : "Asignar Nueva Línea de Crédito"}
            description={initialContact ? "Ajuste el cupo autorizado para este cliente." : "Busque un contacto para habilitar su cupo de crédito."}
            size="md"
            contentClassName="p-0"
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                type="submit"
                                form="credit-assignment-form"
                                loading={isUpdating}
                                disabled={!activeContact}
                            >
                                {isUpdating ? "Guardando..." : "Confirmar Asignación"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form id="credit-assignment-form" onSubmit={form.handleSubmit(onSubmit as any)}>
                    <div className="p-6 space-y-6 min-h-[380px]">
                        {!initialContact && (
                            <AdvancedContactSelector
                                label="Buscar Cliente"
                                placeholder="Nombre o RUT..."
                                value={selectedContact?.id || null}
                                onChange={(id) => !id && setSelectedContact(null)}
                                onSelectContact={setSelectedContact}
                                contactType="CUSTOMER"
                            />
                        )}

                        {activeContact ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                {/* Indicators grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 rounded-lg border bg-muted/30 flex flex-col gap-1 items-center justify-center">
                                        <TrendingUp className="h-4 w-4 text-success mb-1" />
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Disponible</span>
                                        <span className="text-lg font-mono font-black text-success">
                                            {fmt(activeContact.credit_available || 0)}
                                        </span>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/30 flex flex-col gap-1 items-center justify-center">
                                        <Banknote className="h-4 w-4 text-destructive mb-1" />
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Utilizado</span>
                                        <span className="text-lg font-mono font-black text-destructive">
                                            {fmt(activeContact.credit_balance_used || 0)}
                                        </span>
                                    </div>
                                </div>

                                <FormField
                                    control={form.control as any}
                                    name="credit_limit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <LabeledInput
                                                label="Límite de Crédito Autorizado ($)"
                                                type="number"
                                                placeholder=" 1.000,000"
                                                error={form.formState.errors.credit_limit?.message}
                                                {...field}
                                                value={field.value ?? ""}
                                                className="font-mono font-bold"
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                            />
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/10 mt-2">
                                                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                                <p className="text-[11px] text-warning leading-tight">
                                                    Establezca 0 o deje vacío para deshabilitar el crédito.
                                                    Los días de plazo se aplican automáticamente según la política global.
                                                </p>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-20 grayscale">
                                <Banknote className="h-12 w-12 mb-2" />
                                <p className="text-sm font-medium">Seleccione un cliente para ver su estado</p>
                            </div>
                        )}
                    </div>
                </form>
            </Form>
        </BaseModal>
    )
}
