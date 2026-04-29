"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form"
import api from "@/lib/api"
import { toast } from "sonner"
import { LabeledInput, FormFooter, CancelButton } from "@/components/shared"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

const schema = z.object({
    transaction_number: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TransactionNumberFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    paymentId: number | null
    initialValue?: string
    onSuccess?: () => void
}

export function TransactionNumberForm({
    open,
    onOpenChange,
    paymentId,
    initialValue = "",
    onSuccess
}: TransactionNumberFormProps) {
    const [loading, setLoading] = useState(false)

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            transaction_number: initialValue,
        },
    })

    // Update form values if initialValue changes (when modal opens for different payment)
    useState(() => {
        if (open) form.reset({ transaction_number: initialValue })
    })

    const onSubmit = async (data: FormData) => {
        if (!paymentId) return
        setLoading(true)
        try {
            await api.patch(`/treasury/payments/${paymentId}/`, {
                transaction_number: data.transaction_number
            })
            toast.success("N° de transacción actualizado")
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Failed to update transaction number", error)
            toast.error("Error al actualizar N° de transacción")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xs"
            title="Registrar N° de Transacción"
            description="Ingrese el número de comprobante o transacción bancaria."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton type="submit" form="transaction-number-form" loading={loading}>
                                Guardar
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form id="transaction-number-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="transaction_number"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormControl>
                                    <LabeledInput
                                        label="N° de Transacción"
                                        placeholder="Ex: 543210"
                                        error={fieldState.error?.message}
                                        autoFocus
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </BaseModal>
    )
}
