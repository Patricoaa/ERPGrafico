"use client"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Hash } from "lucide-react"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form"
import { financeApi } from "../api/financeApi"
import { toast } from "sonner"
import { Drawer, LabeledInput, FormFooter, FormSplitLayout, CancelButton, ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components"
import { formDrawerWidth } from "@/lib/form-widths"

const schema = z.object({
    transaction_number: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TransactionNumberDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    paymentId: number | null
    initialValue?: string
    onSuccess?: () => void
}

export function TransactionNumberDrawer({
    open,
    onOpenChange,
    paymentId,
    initialValue = "",
    onSuccess
}: TransactionNumberDrawerProps) {
    const [loading, setLoading] = useState(false)

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            transaction_number: initialValue,
        },
    })

    // Update form values if initialValue changes (when modal opens for different payment)
    useEffect(() => {
        if (open) form.reset({ transaction_number: initialValue })
    }, [open, initialValue, form])

    const onSubmit = async (data: FormData) => {
        if (!paymentId) return
        setLoading(true)
        try {
            await financeApi.updatePayment(paymentId, {
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

    const width = formDrawerWidth("micro", !!paymentId)

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={width}
            icon={Hash}
            title="Registrar N° de Transacción"
            subtitle="Ingrese el número de comprobante o transacción bancaria."
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
            <FormSplitLayout
              sidebar={paymentId ? (
                <ActivitySidebar
                  entityId={paymentId}
                  entityType="payment"
                />
              ) : undefined}
              showSidebar={!!paymentId}
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
            </FormSplitLayout>
        </Drawer>
    );
}