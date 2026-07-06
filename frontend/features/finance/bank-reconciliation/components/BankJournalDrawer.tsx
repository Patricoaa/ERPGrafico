"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { financeApi } from "../../api/financeApi"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { Printer } from "lucide-react"
import { Drawer, LabeledInput, LabeledSelect, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"
import { formDrawerWidth } from "@/lib/form-widths"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"

const journalSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().min(1, "La cuenta contable es requerida"),
})

type JournalFormValues = z.infer<typeof journalSchema>

interface BankJournalDrawerProps {
    auditSidebar?: React.ReactNode
    onSuccess?: () => void
    initialData?: Record<string, unknown> | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    mode?: DrawerMode
}

export function BankJournalDrawer({ auditSidebar, onSuccess, initialData, open: openProp, onOpenChange, mode: modeProp }: BankJournalDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [loading, setLoading] = useState(false)
    const width = formDrawerWidth("simple", !!initialData)

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalSchema),
        defaultValues: initialData ? {
            ...initialData,
            account: initialData.account?.toString() || "",
        } : {
            name: "",
            code: "",
            currency: "CLP",
        },
    })



    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    account: (initialData.account as { id?: number } | undefined)?.id?.toString() || initialData.account?.toString() || "",
                })
            } else {
                form.reset({
                    name: "",
                    code: "",
                    currency: "CLP",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: JournalFormValues) {
        setLoading(true)
        try {
            if (initialData && initialData.id) {
                await financeApi.updateJournal(initialData.id as number, data)
            } else {
                await financeApi.createJournal(data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving journal:", error)
            showApiError(error, "Error al guardar la caja/banco")
        } finally {
            setLoading(false)
        }
    }

    const identity = useDrawerIdentity('finance.bankjournal', mode, initialData as Record<string, unknown> | undefined, {
        customTitle: isView
            ? `Ficha de Caja/Banco${initialData?.id ? ` #${initialData.id}` : ""}`
            : mode === 'create'
                ? "Crear Caja o Banco"
                : "Editar Caja/Banco",
        subtitle: initialData ? `${(initialData?.code as string) || ""} • ${form.watch("name") || ""}` : "Tesorería • Configuración de Caja o Banco",
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="BankJournal"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{(initialData?.name as string) ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Código:</span>
                            <span>{(initialData?.code as string) ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={(mode === 'view' || mode === 'edit') && !!initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="bank-journal-form" loading={loading}>
                                    {mode === 'create' ? "Crear Caja/Banco" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <div className="flex-1 flex overflow-hidden min-h-[400px]">
                    <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                        <Form {...form}>
                            <form id="bank-journal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                <fieldset disabled={isView} className="contents">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Nombre"
                                                required
                                                placeholder="Banco Estado Cta Cte"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Código"
                                                required
                                                placeholder="BEST-CTE"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field, fieldState }) => (
                                                    <LabeledSelect
                                                        label="Moneda"
                                                        required
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        error={fieldState.error?.message}
                                                        options={[
                                                    { value: "CLP", label: "CLP (Peso Chileno)" },
                                                    { value: "USD", label: "USD (Dólar)" },
                                                    { value: "EUR", label: "EUR (Euro)" }
                                                ]}
                                                placeholder="Seleccione moneda"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="account"
                                        render={({ field, fieldState }) => (
                                                    <AccountSelector
                                                        label="Cuenta Contable"
                                                        required
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        accountType="ASSET"
                                                        error={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                </fieldset>
                            </form>
                        </Form>
                    </div>

                    {!!initialData?.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                            {auditSidebar}
                        </div>
                    )}
                </div>
            </Drawer>
        </>
    )
}
