"use client"
import { useState } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form"
import { showApiError } from "@/lib/errors"
import { financeApi } from "../api/financeApi"
import { toast } from "sonner"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { Drawer, LabeledInput, FormFooter, FormSplitLayout, CancelButton, ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
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
    mode?: DrawerMode
}

export function TransactionNumberDrawer({
    open,
    onOpenChange,
    paymentId,
    initialValue = "",
    onSuccess,
    mode: modeProp
}: TransactionNumberDrawerProps) {
    const mode: DrawerMode = modeProp ?? 'edit'
    const isView = mode === 'view'
    const { printRef, handlePrint } = usePrintableDrawer()
    const [loading, setLoading] = useState(false)

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            transaction_number: initialValue,
        },
    })

    useInitializeDrawerForm({
        form,
        open,
        initialData: paymentId ? { id: paymentId, value: initialValue } : undefined,
        mapData: (data) => ({
            transaction_number: data.value,
        }),
        defaultValues: () => ({
            transaction_number: initialValue,
        }),
    })

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
            showApiError(error, "Error al actualizar N° de transacción")
        } finally {
            setLoading(false)
        }
    }

    const width = formDrawerWidth("micro", !!paymentId)

    const identity = useDrawerIdentity('finance.payment', mode, paymentId ? { id: paymentId } : undefined, {
        overrideTitle: isView
            ? `Ficha de Transacción${paymentId ? ` #${paymentId}` : ""}`
            : "Registrar N° de Transacción",
        overrideSubtitle: "Ingrese el número de comprobante o transacción bancaria.",
        printable: (mode === 'view' || mode === 'edit') && !!paymentId,
        onPrint: handlePrint,
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && paymentId && (
                <PrintableLayout ref={printRef} title="N° de Transacción" displayId={`#${paymentId}`}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>N° de Transacción:</span>
                            <span>{initialValue ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                fillContent
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
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
                )}
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
                        <form id="transaction-number-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
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
                            </fieldset>
                        </form>
                    </Form>
                </FormSplitLayout>
            </Drawer>
        </>
    );
}