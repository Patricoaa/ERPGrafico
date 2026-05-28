"use client"

import { getErrorMessage } from "@/lib/errors"
import { useState, useEffect, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { JournalEntryInitialData } from "@/types/forms"
import * as z from "zod"
import { CalendarIcon, Plus, Pencil, BookOpen, Printer, X } from "lucide-react"
import { format } from "date-fns"
import {
    Form,
    FormField,
    FormMessage,
} from "@/components/ui/form"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { useServerDate } from "@/hooks/useServerDate"
import { useReactToPrint } from "react-to-print"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate } from "@/lib/utils"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { Drawer, LabeledInput, LabeledContainer, CancelButton, SubmitButton, IconButton, PeriodValidationDateInput, ActionSlideButton, FormFooter, FormSplitLayout, FormSection, AccountingLinesTable, SkeletonShell, StatusBadge } from "@/components/shared";
import { formDrawerWidth } from "@/lib/form-widths";
import { ActivitySidebar } from "@/features/audit/components";

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

interface JournalEntryDrawerProps {
    auditSidebar?: React.ReactNode
    accounts?: Record<string, unknown>[]
    onSuccess?: () => void
    initialData?: JournalEntryInitialData
    triggerText?: string
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: 'view' | 'edit'
    journalEntryId?: number
}



export function JournalEntryDrawer({
    accounts: accountsProp,
    onSuccess,
    initialData,
    triggerText = "Nuevo Asiento",
    triggerVariant = "default",
    open: openProp,
    onOpenChange,
    auditSidebar,
    inline = false,
    onLoadingChange,
    mode = 'edit',
    journalEntryId,
}: JournalEntryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const isViewMode = mode === 'view'
    const entityId = journalEntryId ?? initialData?.id
    const { data: viewEntry, isLoading: isViewLoading } = useJournalEntry(isViewMode ? entityId : undefined)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [loading, setLoading] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)

    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(loading)
        }
    }, [loading, onLoadingChange])

    // Guard for async operations
    const isMounted = useRef(true)

    // Cleanup mount guard
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const { accounts: fetchedAccounts, isLoading: isAccountsLoading } = useAccounts({ filters: { is_leaf: true } })
    const accounts = (accountsProp?.length ? accountsProp : fetchedAccounts) as Record<string, unknown>[]

    const { serverDate, isLoading: isServerDateLoading } = useServerDate()

    const isFetchingInitialData = open && (isAccountsLoading || isServerDateLoading)

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
    
    const width = formDrawerWidth("master", !!initialData?.id)

    const selectedDate = form.watch("date")

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

    const renderViewContent = () => {
        if (isViewLoading) return <SkeletonShell isLoading ariaLabel="Cargando asiento contable" />
        if (!viewEntry) return null

        const lines = viewEntry.items ?? []
        const totalDebit = lines.reduce((sum: number, item: any) => sum + Number(item.debit ?? 0), 0)
        const totalCredit = lines.reduce((sum: number, item: any) => sum + Number(item.credit ?? 0), 0)

        return (
            <div className="p-4 space-y-4">
                <StatusBadge status={viewEntry.status} />
                <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
                    <div>
                        <span className="text-xs text-muted-foreground">Fecha</span>
                        <p className="font-medium">{formatPlainDate(viewEntry.date)}</p>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Referencia</span>
                        <p className="font-medium">{viewEntry.reference ?? '-'}</p>
                    </div>
                    <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Descripción</span>
                        <p className="font-medium">{viewEntry.description ?? viewEntry.label ?? '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Diario</span>
                        <p className="font-medium">{viewEntry.journal_name ?? '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Período</span>
                        <p className="font-medium">{viewEntry.period_name ?? '-'}</p>
                    </div>
                </div>
                {lines.length > 0 && (
                    <div>
                        <h4 className="text-sm font-bold mb-2">Líneas del Asiento</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Cuenta</th>
                                        <th className="p-2 text-left">Glosa</th>
                                        <th className="p-2 text-right">Debe</th>
                                        <th className="p-2 text-right">Haber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((item: any, idx: number) => (
                                        <tr key={item.id ?? idx} className="border-t">
                                            <td className="p-2">
                                                <span className="font-medium">{item.account_name}</span>
                                                <span className="text-xs text-muted-foreground ml-1 font-mono">{item.account_code}</span>
                                            </td>
                                            <td className="p-2 text-muted-foreground">{item.label ?? '-'}</td>
                                            <td className="p-2 text-right font-mono">
                                                {Number(item.debit) > 0 ? formatCurrency(Number(item.debit)) : '-'}
                                            </td>
                                            <td className="p-2 text-right font-mono">
                                                {Number(item.credit) > 0 ? formatCurrency(Number(item.credit)) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/50 font-bold">
                                    <tr>
                                        <td colSpan={2} className="p-2 text-right">Totales:</td>
                                        <td className="p-2 text-right font-mono">{formatCurrency(totalDebit)}</td>
                                        <td className="p-2 text-right font-mono">{formatCurrency(totalCredit)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const Trigger = () => {
        if (isViewMode) return null;
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

    const journalFormFields = (
        <Form {...form}>
            <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4 pt-4">
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

                <AccountingLinesTable control={form.control as any} name="items" />

                <FormMessage className="text-right" />
                {form.formState.errors.items?.root && (
                    <div className="text-destructive text-sm text-right font-medium">
                        {form.formState.errors.items.root.message}
                    </div>
                )}
            </form>
        </Form>
    )

    const formContent = (
        <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de asiento contable" className="flex-1 flex flex-col">
            <FormSplitLayout
                sidebar={initialData?.id ? (
                    <ActivitySidebar entityType="journal_entry" entityId={initialData.id} />
                ) : undefined}
                showSidebar={!!initialData?.id}
            >
                {journalFormFields}
            </FormSplitLayout>
        </SkeletonShell>
    )

    if (inline) {
        return <>{formContent}</>
    }

    const drawerTitle = isViewMode
        ? `Asiento #${entityId}`
        : initialData
            ? "Editar Asiento"
            : "Nuevo Asiento Contable"

    const drawerSubtitle = isViewMode
        ? viewEntry?.description ?? 'Vista de detalle'
        : initialData?.reference
            ? `Ref: ${initialData.reference} • ${form.watch("description") || "Registro manual"}`
            : (form.watch("description") || "Registro manual de movimiento")

    return (
        <>
            {isViewMode && viewEntry && (
                <PrintableLayout
                    ref={printRef}
                    title="Asiento Contable"
                    displayId={viewEntry.display_id ?? `#${entityId}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Descripción:</span>
                            <span>{viewEntry.description ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Referencia:</span>
                            <span>{viewEntry.reference ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Fecha:</span>
                            <span>{formatPlainDate(viewEntry.date)}</span>
                        </div>
                    </div>
                    <div className="text-[9px]">
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Cuenta</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                        </div>
                        {(viewEntry.items ?? []).map((item: any, idx: number) => (
                            <div key={item.id ?? idx} className="grid grid-cols-[1fr,50px,50px] gap-1 border-b border-dashed py-0.5">
                                <span>{item.account_name ?? '-'}</span>
                                <span className="text-right">{Number(item.debit) > 0 ? formatCurrency(Number(item.debit)) : '-'}</span>
                                <span className="text-right">{Number(item.credit) > 0 ? formatCurrency(Number(item.credit)) : '-'}</span>
                            </div>
                        ))}
                    </div>
                </PrintableLayout>
            )}
            <Trigger />
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={isViewMode ? "50%" : width}
                contentClassName={isViewMode ? undefined : "p-0"}
                icon={BookOpen}
                title={drawerTitle}
                subtitle={drawerSubtitle}
                headerActions={isViewMode ? (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : undefined}
                footer={isViewMode ? undefined : (
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
                )}
            >
                {isViewMode ? renderViewContent() : formContent}
            </Drawer>
        </>
    )
}
