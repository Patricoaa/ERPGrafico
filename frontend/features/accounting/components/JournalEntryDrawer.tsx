"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, type Control, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { type JournalEntryInitialData } from "@/types/forms"
import * as z from "zod"
import { Plus, Pencil, Printer, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { toDate } from "@/lib/utils"
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

import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { Chip, Drawer, LabeledInput, CancelButton, IconButton, PeriodValidationDateInput, ActionSlideButton, FormFooter, FormSplitLayout, FormSection, AccountingLinesTable, SkeletonShell, StatusBadge, SourceDocumentLink } from "@/components/shared";
import { SourceDocumentSelector, type SourceDocument } from "@/components/selectors/SourceDocumentSelector";
import { formDrawerWidth } from "@/lib/form-widths";
import { ActivitySidebar } from "@/features/audit/components";
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

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
    mode?: DrawerMode
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
    inline = false,
    onLoadingChange,
    mode: modeProp,
    journalEntryId,
}: JournalEntryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isViewMode = mode === 'view'
    const entityId = journalEntryId ?? initialData?.id
    const { data: viewEntry, isLoading: isViewLoading } = useJournalEntry(isViewMode ? entityId : undefined)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [loading, setLoading] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)
    const [isViewSynced, setIsViewSynced] = useState(false)
    const [sourceDocument, setSourceDocument] = useState<SourceDocument | null>(null)

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

    const isFetchingInitialData = open && (isViewMode ? (isViewLoading || !isViewSynced) : (isAccountsLoading || isServerDateLoading))

    // Convert string date to Date object if editing
    const getDefaultValues = () => {
        if (initialData) {
            return {
                ...initialData,
                date: toDate(initialData.date),
                items: initialData.items.map((item) => ({
                    ...item,
                    account: item.account.toString(),
                    debit: parseFloat(item.debit as unknown as string),
                    credit: parseFloat(item.credit as unknown as string),
                }))
            }
        } else {
            return {
                date: serverDate || new Date(),
                description: "",
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
            setIsViewSynced(false)
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
            setSourceDocument(null)
        } else {
            form.reset({
                date: toDate(initialData.date),
                description: initialData.description,
                items: initialData.items.map((item) => ({
                    account: item.account?.toString() ?? '',
                    partner: item.partner?.toString() ?? '',
                    label: item.label ?? '',
                    debit: Number(item.debit ?? 0),
                    credit: Number(item.credit ?? 0),
                })),
            })
        }
    }, [open, initialData, serverDate])

    // Sync sourceDocument from initialData (outside lastResetKey guard)
    useEffect(() => {
        if (!initialData || !open) {
            setSourceDocument(null)
            return
        }
        const sourceDoc = (initialData as unknown as { source_documents?: Array<Record<string, unknown>> }).source_documents?.[0]
        if (sourceDoc) {
            const sDoc = sourceDoc
            setSourceDocument({
                content_type_id: sDoc.content_type_id as number,
                object_id: (sDoc.object_id ?? sDoc.id) as number,
                display: (sDoc.display ?? sDoc.name ?? `Documento #${(sDoc.object_id ?? sDoc.id) as number}`) as string,
                label: (sDoc.type as string) ?? '',
                icon: '',
            })
        }
    }, [initialData, open])

    const viewEntryAccountId = (item: Record<string, unknown>): string => {
        const acct = item.account
        if (acct == null) return (item.account_code as string) ?? ''
        if (typeof acct === 'object') return String((acct as Record<string, unknown>).id ?? (item.account_code as string) ?? '')
        return String(acct)
    }

    useEffect(() => {
        if (isViewMode && viewEntry) {
            form.reset({
                date: toDate(viewEntry.date),
                description: viewEntry.description ?? viewEntry.label ?? '',
                items: (viewEntry.items ?? []).map((item: Record<string, unknown>) => ({
                    account: viewEntryAccountId(item),
                    partner: (item.partner as string) ?? '',
                    label: (item.label as string) ?? '',
                    debit: Number(item.debit ?? 0),
                    credit: Number(item.credit ?? 0),
                })),
            })
            setIsViewSynced(true)
        }
    }, [isViewMode, viewEntry, form])

    async function onSubmit(data: JournalEntryFormValues) {
        setLoading(true)
        try {
            if (!isPeriodValid) {
                toast.error("No se puede registrar el asiento: El periodo contable está cerrado.")
                setLoading(false)
                return
            }

            const payload: Record<string, unknown> = {
                ...data,
                items: data.items.map(i => ({
                    ...i,
                    partner: i.partner || null,
                })),
                date: format(data.date, "yyyy-MM-dd"),
                is_manual: true,
            }

            if (sourceDocument) {
                payload.source_content_type_id = sourceDocument.content_type_id
                payload.source_object_id = sourceDocument.object_id
            }

            if (initialData?.id) {
                await accountingApi.updateEntry(initialData.id, payload)
                toast.success("Asiento actualizado correctamente")
            } else {
                await accountingApi.createEntry(payload as Record<string, unknown>)
                toast.success("Asiento creado correctamente")
            }

            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            showApiError(error, "Error al guardar el asiento")
        } finally {
            setLoading(false)
        }
    }

    const getStatus = (): string | undefined => {
        if (isViewMode) return viewEntry?.status
        if (initialData) return (initialData as unknown as { status?: string }).status
        return 'DRAFT'
    }
    const entryStatus = getStatus() || 'DRAFT'

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
            <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                <fieldset disabled={isViewMode} className="contents">
                    <div className="grid grid-cols-12 gap-4 ">
                        <div className="col-span-3">
                            <fieldset className="notched-field pointer-events-none" aria-disabled="true">
                                <legend>Estado</legend>
                                <StatusBadge status={entryStatus} size="sm" />
                            </fieldset>
                        </div>
                        <div className="col-span-3">
                            <fieldset className="notched-field pointer-events-none" aria-disabled="true">
                                <legend>Origen</legend>
                                {isViewMode ? (
                                    <Chip size="xs" intent={viewEntry?.is_manual ? "neutral" : viewEntry?.reversal_of ? "warning" : "info"}>
                                        {viewEntry?.is_manual ? "Manual" : viewEntry?.reversal_of ? "Reversión" : "Automático"}
                                    </Chip>
                                ) : (
                                    <Chip size="xs" intent="neutral">Manual</Chip>
                                )}
                            </fieldset>
                        </div>
                        <div className="col-span-6">
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
                                        disabled={isViewMode}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 mt-4">
                        <div className="col-span-6">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Descripción"
                                        required
                                        placeholder="Venta de mercadería..."
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )}
                            />
                        </div>
                        <div className="col-span-6">
                            {isViewMode && viewEntry?.source_documents && viewEntry.source_documents.length > 0 ? (
                                <fieldset className="notched-field h-full" aria-disabled="true">
                                    <legend>Documento Origen</legend>
                                    <div className="flex items-center gap-2">
                                        {viewEntry.source_documents.map((doc: { type: string; id: number; display?: string; name?: string; url?: string }) => (
                                            <SourceDocumentLink key={doc.id} doc={doc as unknown as { type: string; id: number; display?: string; name?: string; url?: string }} />
                                        ))}
                                    </div>
                                </fieldset>
                            ) : isViewMode ? (
                                <fieldset className="notched-field pointer-events-none h-full" aria-disabled="true">
                                    <legend>Documento Origen</legend>
                                    <span className="text-muted-foreground text-sm">—</span>
                                </fieldset>
                            ) : (
                                <SourceDocumentSelector
                                    value={sourceDocument}
                                    onChange={setSourceDocument}
                                    allowedLabels={[
                                        "sales.saleorder",
                                        "sales.saledelivery",
                                        "sales.salereturn",
                                        "purchasing.purchaseorder",
                                        "purchasing.purchasereturn",
                                        "billing.invoice",
                                        "inventory.stockmove",
                                        "treasury.treasurymovement",
                                        "treasury.bankstatement",
                                        "production.workorder",
                                        "hr.payroll",
                                        "contacts.contact",
                                        "contacts.partnertransaction",
                                        "contacts.profitdistributionresolution",
                                    ]}
                                />
                            )}
                        </div>
                    </div>

                    <FormSection title="Líneas del Asiento" className="space-y-2" />

                    <AccountingLinesTable control={form.control as unknown as Control<FieldValues>} name="items" disabled={isViewMode} />

                    {isViewMode && viewEntry?.reversal_of && (
                        <div className="flex justify-end items-center gap-1.5 text-xs text-muted-foreground pt-2">
                            <span>Reversión de:</span>
                            <Link
                                href={`/accounting/entries/${viewEntry.reversal_of.id}`}
                                className="inline-flex items-center gap-1 text-primary underline font-medium hover:text-primary/80"
                            >
                                {viewEntry.reversal_of.display_id}
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        </div>
                    )}

                    <FormMessage className="text-right" />
                    {form.formState.errors.items?.root && (
                        <div className="text-destructive text-sm text-right font-medium">
                            {form.formState.errors.items.root.message}
                        </div>
                    )}
                </fieldset>
            </form>
        </Form>
    )

    const formContent = (
        <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando asiento contable" className="flex-1 flex flex-col">
            <FormSplitLayout
                sidebar={entityId ? (
                    <ActivitySidebar entityType="journal_entry" entityId={entityId} />
                ) : undefined}
                showSidebar={!!entityId}
            >
                {journalFormFields}
            </FormSplitLayout>
        </SkeletonShell>
    )

    if (inline) {
        return <>{formContent}</>
    }

    const identity = useDrawerIdentity('accounting.journalentry', mode, (viewEntry ?? initialData) as Record<string, unknown> | undefined, {
        customTitle: isViewMode
            ? `Asiento #${entityId}`
            : mode === 'edit'
                ? "Editar Asiento"
                : undefined,
        subtitle: isViewMode
            ? form.watch("description") || 'Vista de detalle'
            : form.watch("description") || "Registro manual de movimiento",
    })

    const showPrintable = entityId && (mode === 'view' || mode === 'edit')

    const formValues = form.watch()

    return (
        <>
            {showPrintable && (
                <PrintableLayout
                    ref={printRef}
                    title="Asiento Contable"
                    displayId={`#${entityId}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Descripción:</span>
                            <span>{formValues.description || '-'}</span>
                        </div>
                        {isViewMode && viewEntry?.source_documents?.[0] && (
                            <div className="flex justify-between">
                                <span>Documento origen:</span>
                                <span>{viewEntry.source_documents[0].display_name ?? `#${viewEntry.source_documents[0].id}`}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>{isViewMode ? (viewEntry?.is_manual ? "Manual" : viewEntry?.reversal_of ? "Reversión" : "Automático") : "Manual"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Fecha:</span>
                            <span>{formValues.date ? format(formValues.date, 'dd/MM/yyyy') : '-'}</span>
                        </div>
                    </div>
                    <div className="text-[9px]">
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Cuenta</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                        </div>
                        {(formValues.items ?? []).map((item, idx: number) => (
                            <div key={idx} className="grid grid-cols-[1fr,50px,50px] gap-1 border-b border-dashed py-0.5">
                                <span>{item.account ? item.account.toString() : '-'}</span>
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
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={showPrintable && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={identity.subtitle}
                footer={isViewMode ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="journal-entry-form" loading={loading}>
                                    {mode === 'create' ? "Crear Asiento" : "Actualizar Asiento"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                {formContent}
            </Drawer>
        </>
    )
}
