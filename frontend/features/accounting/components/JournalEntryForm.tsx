"use client"

import { getErrorMessage } from "@/lib/errors"
import { useState, useEffect, useRef, useCallback } from "react"
import { useForm, useFieldArray, useWatch, Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { JournalEntryInitialData } from "@/types/forms"
import * as z from "zod"
import { CalendarIcon, Plus, Trash2, Pencil, BookOpen } from "lucide-react"
import { format } from "date-fns"
import { BaseModal } from "@/components/shared/BaseModal"

// ... other imports same
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useServerDate } from "@/hooks/useServerDate"
import { LabeledInput, LabeledContainer, CancelButton, SubmitButton, IconButton, PeriodValidationDateInput, ActionSlideButton, FormFooter, FormSplitLayout, FormSection } from "@/components/shared";

// JournalItem and JournalEntry schemas remain the same
const journalItemSchema = z.object({
    id: z.number().optional(),
    account: z.string().min(1, "Cuenta requerida"),
    partner: z.string().optional(),
    label: z.string().optional(),
    debit: z.number().min(0),
    credit: z.number().min(0),
})

const journalEntrySchema = z.object({
    date: z.date(),
    description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
    reference: z.string().optional(),
    items: z.array(journalItemSchema).min(2, "El asiento debe tener al menos 2 líneas"),
}).refine((data) => {
    const totalDebit = data.items.reduce((sum, item) => sum + (item.debit || 0), 0)
    const totalCredit = data.items.reduce((sum, item) => sum + (item.credit || 0), 0)
    return Math.abs(totalDebit - totalCredit) < 0.01 // Floating point tolerance
}, {
    message: "El asiento no está cuadrado (Debe != Haber)",
    path: ["items"],
})

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>

interface JournalEntryFormProps {
    auditSidebar?: React.ReactNode
    accounts?: Record<string, unknown>[]
    onSuccess?: () => void
    initialData?: JournalEntryInitialData
    triggerText?: string
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

const TotalBalance = ({ control }: { control: Control<JournalEntryFormValues> }) => {
    const items = useWatch({
        control,
        name: "items",
    })

    const totalDebit = items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) || 0
    const totalCredit = items?.reduce((sum, item) => sum + (Number(item.credit) || 0), 0) || 0
    const diff = totalDebit - totalCredit
    const isBalanced = Math.abs(diff) < 0.01

    return (
        <div className="flex justify-end space-x-4 text-sm font-medium pt-2 border-t">
            <div className={cn("flex flex-col items-end", isBalanced ? "text-success" : "text-destructive")}>
                <span>Total Debe: {totalDebit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                <span>Total Haber: {totalCredit.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                {!isBalanced && <span>Diferencia: {diff.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>}
            </div>
        </div>
    )
}

export function JournalEntryForm({
    accounts: accountsProp,
    onSuccess,
    initialData,
    triggerText = "Nuevo Asiento",
    triggerVariant = "default",
    open: openProp,
    onOpenChange,
    auditSidebar
}: JournalEntryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // Guard for async operations
    const isMounted = useRef(true)

    // Cleanup mount guard
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const { accounts: fetchedAccounts } = useAccounts({ filters: { is_leaf: true } })
    const accounts = (accountsProp?.length ? accountsProp : fetchedAccounts) as Record<string, unknown>[]

    const { serverDate } = useServerDate()

    // Convert string date to Date object if editing
    const getDefaultValues = () => {
        if (initialData) {
            return {
                ...initialData,
                date: new Date(initialData.date),
                items: initialData.items.map((item: any) => ({
                    ...item,
                    account: item.account.toString(),
                    debit: parseFloat(item.debit),
                    credit: parseFloat(item.credit),
                }))
            }
        } else {
            return {
                date: serverDate || new Date(),
                description: "",
                reference: "",
                items: [
                    { account: "", label: "", debit: 0, credit: 0 },
                    { account: "", label: "", debit: 0, credit: 0 },
                ],
            }
        }
    }

    const defaultValues: Partial<JournalEntryFormValues> = getDefaultValues()

    const form = useForm<JournalEntryFormValues>({
        resolver: zodResolver(journalEntrySchema),
        defaultValues,
    })

    const selectedDate = form.watch("date")

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const lastResetKey = useRef<string | null>(null)

    useEffect(() => {
        if (!open) {
            lastResetKey.current = null
            return
        }
        const resetKey = initialData?.id ? `edit-${initialData.id}` : `new-${serverDate?.getTime() ?? 'pending'}`
        if (lastResetKey.current === resetKey) return
        lastResetKey.current = resetKey

        if (!initialData) {
            form.reset({
                date: serverDate || new Date(),
                description: "",
                items: [
                    { account: "", label: "", debit: 0, credit: 0 },
                    { account: "", label: "", debit: 0, credit: 0 },
                ]
            })
        } else {
            form.reset(defaultValues)
        }
    }, [open, initialData, serverDate])

    async function onSubmit(data: JournalEntryFormValues) {
        setLoading(true)
        try {
            if (!isPeriodValid) {
                toast.error("No se puede registrar el asiento: El periodo contable está cerrado.")
                setLoading(false)
                return
            }

            const payload = {
                ...data,
                date: format(data.date, "yyyy-MM-dd"),
            }

            if (initialData?.id) {
                await accountingApi.updateEntry(initialData.id, payload)
                toast.success("Asiento actualizado correctamente")
            } else {
                await accountingApi.createEntry(payload)
                toast.success("Asiento creado correctamente")
            }

            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving entry:", error)
            const detail = getErrorMessage(error) || "Error al guardar el asiento"
            // Check if validation array error
            if (typeof detail === 'object') {
                toast.error("Error de validación: Revise los campos")
            } else {
                toast.error(detail)
            }
        } finally {
            setLoading(false)
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null;
        if (initialData && triggerVariant !== "circular") return null;

        return (
            <div onClick={() => setOpen(true)}>
                {triggerVariant === "circular" ? (
                    <IconButton circular title="Nuevo Asiento" className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4" />
                    </IconButton>
                ) : (
                    <Button variant={initialData ? "ghost" : "default"} size={initialData ? "icon" : "default"}>
                        {initialData ? <Pencil className="h-4 w-4" /> : triggerText}
                    </Button>
                )}
            </div>
        )
    }

    return (
        <>
            <Trigger />
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size={initialData ? "xl" : "lg"}
                hideScrollArea={true}
                contentClassName="p-0"
                title={
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Editar Asiento" : "Nuevo Asiento Contable"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {initialData?.reference && (
                            <>
                                <span>Ref: {initialData.reference}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("description") || "Registro manual de movimiento"}</span>
                    </div>
                }
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="journal-entry-form" loading={loading}>
                                    {initialData ? "Actualizar Asiento" : "Crear Asiento"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                }
            >
                <FormSplitLayout
                    sidebar={auditSidebar}
                    showSidebar={!!initialData?.id}
                >
                    <Form {...form}>
                        <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 pt-2">
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="date"
                                            render={({ field }) => (
                                                <PeriodValidationDateInput
                                                    date={field.value}
                                                    onDateChange={field.onChange}
                                                    validationType="accounting"
                                                    onValidityChange={setIsPeriodValid}
                                                    label="Fecha"
                                                    required
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-6">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Descripción"
                                                    placeholder="Venta de mercadería..."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <FormField
                                            control={form.control}
                                            name="reference"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Referencia"
                                                    placeholder="FAC-123"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                <FormSection title="Líneas del Asiento" />

                                <div className="border rounded-md p-2">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-b">
                                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-[300px] text-center">Cuenta</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Glosa</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-[150px] text-center">Debe</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-[150px] text-center">Haber</TableHead>
                                                <TableHead className="w-[50px] text-center"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((field, index) => (
                                                <TableRow key={field.id} className="hover:bg-primary/5 transition-colors">
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.account`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0">
                                                                    <FormControl>
                                                                        <AccountSelector
                                                                            value={field.value}
                                                                            onChange={field.onChange}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.label`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0">
                                                                    <FormControl>
                                                                        <LabeledInput
                                                                            {...field}
                                                                            className="h-8 text-center"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.debit`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0 text-center">
                                                                    <FormControl>
                                                                        <LabeledInput
                                                                            type="number"
                                                                            step="1"
                                                                            {...field}
                                                                            onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))}
                                                                            onFocus={(e) => e.target.select()}
                                                                            className="h-8 text-right font-mono font-bold"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.credit`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-0 text-center">
                                                                    <FormControl>
                                                                        <LabeledInput
                                                                            type="number"
                                                                            step="1"
                                                                            {...field}
                                                                            onChange={e => field.onChange(Math.ceil(e.target.valueAsNumber || 0))}
                                                                            onFocus={(e) => e.target.select()}
                                                                            className="h-8 text-right font-mono font-bold"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 text-center">
                                                        <IconButton
                                                            onClick={() => remove(index)}
                                                            className="h-8 w-8 text-muted-foreground/30 hover:text-destructive"
                                                            title="Eliminar línea"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="flex justify-between items-center mt-2 px-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5"
                                            onClick={() => append({ account: "", label: "", debit: 0, credit: 0 })}
                                        >
                                            <Plus className="mr-2 h-3.5 w-3.5" /> Agregar Línea
                                        </Button>
                                        <TotalBalance control={form.control} />
                                    </div>
                                </div>

                                <FormMessage className="text-right" />
                                {form.formState.errors.items?.root && (
                                    <div className="text-destructive text-sm text-right font-medium">
                                        {form.formState.errors.items.root.message}
                                    </div>
                                )}
                            </form>
                        </Form>
                </FormSplitLayout>
            </BaseModal>
        </>
    )
}
