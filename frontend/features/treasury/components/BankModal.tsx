"use client"

import { useEffect } from "react"
import { Landmark } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { EntitySidebar } from "@/features/comments"
import { Form, FormField } from "@/components/ui/form"
import { CancelButton, LabeledInput, BaseModal, FormFooter, FormSplitLayout, SubmitButton } from "@/components/shared"
import { useBanks } from "@/features/treasury/hooks/useMasterData"
import type { Bank } from "@/features/treasury/types"

const bankSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().nullable().optional(),
    swift_code: z.string().max(11, "Máximo 11 caracteres").nullable().optional(),
})

type BankFormValues = z.infer<typeof bankSchema>

export interface BankModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    bank: Bank | null
    onSuccess: () => void
}

export function BankModal({ open, onOpenChange, bank, onSuccess }: BankModalProps) {
    const { createBank, updateBank, isCreating, isUpdating } = useBanks()
    const isSaving = isCreating || isUpdating

    const form = useForm<BankFormValues>({
        resolver: zodResolver(bankSchema),
        defaultValues: {
            name: "",
            code: "",
            swift_code: "",
        },
    })

    useEffect(() => {
        if (open) {
            form.reset({
                name: bank?.name || "",
                code: bank?.code || "",
                swift_code: bank?.swift_code || "",
            })
        }
    }, [open, bank, form])

    const onSubmit = async (data: BankFormValues) => {
        try {
            if (bank) {
                await updateBank({ id: bank.id, payload: data })
            } else {
                await createBank(data)
            }
            onSuccess()
        } catch {
            // Error handled by hook
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={bank ? "xl" : "md"}
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                    <span>{bank ? "Ficha de Banco" : "Nuevo Banco"}</span>
                </div>
            }
            description={bank ? "Modifique los datos del banco y revise su historial." : "Ingrese el nombre y código identificador del nuevo banco."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton
                                type="submit"
                                form="bank-form"
                                loading={isSaving}
                                disabled={isSaving}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                {bank ? "Guardar Cambios" : "Crear Banco"}
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                collapsible
                collapseStorageKey="erpgrafico.drawer.sidebar.bank"
                showSidebar={!!bank?.id}
                sidebar={
                    bank?.id && (
                        <EntitySidebar
                            entityType="bank"
                            entityId={bank.id}
                            title="Historial"
                        />
                    )
                }
            >
                <Form {...form}>
                    <form id="bank-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Nombre"
                                            required
                                            error={fieldState.error?.message}
                                            placeholder="Ej: Banco de Chile"
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Código (Alias)"
                                            error={fieldState.error?.message}
                                            placeholder="Ej: BCHILE"
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="swift_code"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Código SWIFT/BIC"
                                            error={fieldState.error?.message}
                                            placeholder="Ej: BCHICLRM"
                                            maxLength={11}
                                            hint="Código internacional para transferencias"
                                            {...field}
                                            value={field.value || ""}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
    )
}


