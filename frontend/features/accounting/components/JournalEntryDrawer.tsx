"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm, type Control, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { JournalEntryInitialData } from "@/types/forms"
import * as z from "zod"
import { FileText, Link2, Plus, Pencil, type LucideIcon } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { toDate } from "@/lib/utils"
import { Form, FormField, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { useServerDate } from "@/hooks/useServerDate"
import {
    useDrawerIdentity,
    useDrawerMode,
    usePrintableDrawer,
    PrintableLayout,
    type DrawerMode,
} from "@/features/_shared"
import { formatCurrency } from "@/lib/money"
import {
    Chip,
    Drawer,
    LabeledInput,
    LabeledContainer,
    CancelButton,
    IconButton,
    PeriodValidationDateInput,
    SubmitButton,
    FormFooter,
    FormSplitLayout,
    FormSection,
    AccountingLinesTable,
    SkeletonShell,
    StatusBadge,
    DocumentDrawerShell,
    DocumentActionsMenu,
    DocumentLifecycle,
    DocumentFieldGrid,
    type DocumentActionItem,
    type DocumentField,
    type DocumentSheetTab,
    type LifecycleStep,
} from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { EntitySidebar } from "@/features/comments"
import { DocumentRefLink, DocumentRelationsButton, type DocumentRef } from "@/features/documents"
import { useGlobalModals, useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useDocumentRelations } from "@/features/documents/hooks/useDocumentRelations"
import type { DocumentDomain, DocumentLink } from "@/features/documents/types"
import { DocumentRelationsTab } from "@/features/documents/components/DocumentRelationsTab"
import {
    useJournalEntry,
    usePostJournalEntry,
    useReverseJournalEntry,
    useDeleteJournalEntry,
    type JournalEntry,
} from "@/features/accounting/hooks/useJournalEntries"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { journalEntryLineEntity, journalEntryLineSheetViews } from "@/features/accounting"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { journalEntryActions } from "@/features/accounting/journalEntryActions"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const journalItemSchema = z.object({
    id: z.number().optional(),
    account: z.string().min(1, "Cuenta requerida"),
    partner: z.string().optional(),
    label: z.string().optional(),
    debit: z.number().min(0),
    credit: z.number().min(0),
})

const journalEntrySchema = z
    .object({
        date: z.date(),
        description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
        items: z.array(journalItemSchema).min(2, "El asiento debe tener al menos 2 líneas"),
    })
    .refine(
        (data) => {
            const totalDebit = data.items.reduce((sum, item) => sum + (item.debit || 0), 0)
            const totalCredit = data.items.reduce((sum, item) => sum + (item.credit || 0), 0)
            return Math.abs(totalDebit - totalCredit) < 0.01
        },
        { message: "El asiento no está cuadrado (Debe != Haber)", path: ["items"] },
    )

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>

const LABEL = "accounting.journalentry"
const AUDIT_TYPE = "journal_entry"

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface JournalEntryDrawerProps {
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
    side?: "left" | "right"
}

// ---------------------------------------------------------------------------
// Internal: view mode (was JournalEntrySheet)
// ---------------------------------------------------------------------------

interface ViewContentProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
    embedded?: boolean
    side?: "left" | "right"
}

function JournalEntryViewContent({
    id,
    open,
    onOpenChange,
    onActionSuccess,
    embedded = false,
    side = "left",
}: ViewContentProps) {
    const { data: journalEntry, isLoading: loading, isError, refetch: fetchEntryDetails } = useJournalEntry(id ?? undefined)
    const { data: relations } = useDocumentRelations(LABEL, id)
    const invalidateDocuments = useInvalidateDocuments()

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const handleSuccess = () => {
        void fetchEntryDetails()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const { postEntry, isPostingEntry } = usePostJournalEntry({ onSuccess: handleSuccess })
    const { reverseEntry } = useReverseJournalEntry({ onSuccess: handleSuccess })
    const { deleteEntry } = useDeleteJournalEntry({ onSuccess: handleSuccess })

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = journalEntry?.display_id ?? journalEntry?.number
    const identity = useDrawerIdentity(LABEL, "view", journalEntry, {
        overrideTitle: displayId ?? "Asiento Contable",
    })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (journalEntry?.id && displayId) setEntityDisplay(LABEL, journalEntry.id, String(displayId))
    }, [journalEntry?.id, displayId, setEntityDisplay])

    const resolved = resolveRegistryActions(journalEntryActions, journalEntry, [], (actionId) => {
        if (actionId === "post-entry") return journalEntry?.status !== "DRAFT"
        if (actionId === "reverse-entry") return journalEntry?.status !== "POSTED"
        if (actionId === "delete-entry") return journalEntry?.status !== "DRAFT"
        return false
    })

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<JournalEntry>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {
            if (action.id === "post-entry") postEntry(journalEntry!.id)
            else if (action.id === "reverse-entry") reverseEntry(journalEntry!.id)
            else if (action.id === "delete-entry") deleteEntry(journalEntry!.id)
        },
    })

    const primary = resolved.find((r) => r.action.id === "post-entry" && !r.disabled) ?? null
    const secondary = resolved.filter((r) => r.action.id !== "post-entry" && r.action.id !== "delete-entry")
    const destructive = resolved.find((r) => r.action.id === "delete-entry") ?? null

    const lifecycleSteps = journalEntry ? getJournalEntryLifecycle(journalEntry) : null
    const lines = journalEntry?.items ?? []

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "accounting", "treasury"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = journalEntry
        ? [
              {
                  value: "summary",
                  label: "Resumen",
                  icon: FileText,
                  content: <JournalEntrySummaryTab entry={journalEntry} />,
              },
              {
                  value: "relations",
                  label: "Relaciones",
                  icon: Link2,
                  badge: relations?.relations.length,
                  content: (
                      <DocumentRelationsTab
                          label={LABEL}
                          id={journalEntry.id}
                          sectionActions={getSectionActions(resolved, journalEntry.id, postEntry)}
                          rowActions={getRowActions()}
                          domain={domain}
                          onDomainChange={setDomain}
                      />
                  ),
              },
          ]
        : []

    return (
        <>
            {journalEntry && (
                <PrintableLayout ref={printRef} title="Asiento Contable" displayId={String(displayId ?? "")}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Descripción:</span>
                            <span>{journalEntry.description || "-"}</span>
                        </div>
                        {journalEntry.source_document && (
                            <div className="flex justify-between">
                                <span>Documento origen:</span>
                                <span>{journalEntry.source_document.display_id}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>{journalEntry.is_manual ? "Manual" : journalEntry.reversal_of ? "Reversión" : "Automático"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Fecha:</span>
                            <span>{journalEntry.date ? format(toDate(journalEntry.date), "dd/MM/yyyy") : "-"}</span>
                        </div>
                    </div>
                    <div className="text-4xs">
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Cuenta</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                        </div>
                        {lines.map((item, idx) => (
                            <div key={item.id ?? idx} className="grid grid-cols-[1fr,50px,50px] gap-1 border-b border-dashed py-0.5">
                                <span>
                                    {item.account_code} · {item.account_name}
                                </span>
                                <span className="text-right">{item.debit > 0 ? formatCurrency(item.debit) : "-"}</span>
                                <span className="text-right">{item.credit > 0 ? formatCurrency(item.credit) : "-"}</span>
                            </div>
                        ))}
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-t mt-1 pt-1">
                            <span>Total</span>
                            <span className="text-right">{formatCurrency(lines.reduce((sum, l) => sum + (l.debit || 0), 0))}</span>
                            <span className="text-right">{formatCurrency(lines.reduce((sum, l) => sum + (l.credit || 0), 0))}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                side={side}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={
                    journalEntry && (
                        <DocumentActionsMenu
                            primary={primary ? toItem(primary) : null}
                            actions={[...secondary.map(toItem), ...(destructive ? [toItem(destructive)] : [])]}
                            onPrint={handlePrint}
                        />
                    )
                }
                isLoading={loading || (!journalEntry && !isError)}
                error={isError ? new Error("No se pudo cargar el asiento") : undefined}
                loadingLabel="Cargando asiento contable"
                lifecycle={
                    lifecycleSteps && (
                        <DocumentLifecycle
                            steps={lifecycleSteps}
                            onStepClick={openRelationsAt}
                            activeStepId={tab === "relations" ? domain : null}
                        />
                    )
                }
                tabs={tabs}
                tab={tab}
                onTabChange={setTab}
                sidebar={journalEntry && !embedded ? <EntitySidebar entityType={AUDIT_TYPE} entityId={journalEntry.id} /> : undefined}
            />
        </>
    )
}

function JournalEntrySummaryTab({ entry }: { entry: JournalEntry }) {
    const lines = entry.items ?? []

    const contextFields: DocumentField[] = [
        {
            label: "Estado",
            value: <StatusBadge status={entry.status} size="sm" variant="badge" />,
        },
        {
            label: "Tipo",
            value: (
                <Chip size="xs" intent={entry.is_manual ? "neutral" : entry.reversal_of ? "warning" : "info"}>
                    {entry.is_manual ? "Manual" : entry.reversal_of ? "Reversión" : "Automático"}
                </Chip>
            ),
        },
        {
            label: "Fecha",
            value: entry.date ? format(toDate(entry.date), "dd/MM/yyyy") : "—",
        },
        {
            label: "Descripción",
            value: entry.description || "—",
        },
        ...(entry.reversal_of
            ? [
                  {
                      label: "Reversión de",
                      value: (
                          <a href={`/accounting/entries/${entry.reversal_of.id}`} className="text-primary underline hover:text-primary/80">
                              {entry.reversal_of.display_id}
                          </a>
                      ),
                  },
              ]
            : []),
    ]

    const collection = useEntityCollection(journalEntryLineEntity, { rows: lines }, { pagination: { mode: "none" } })

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>

            <section className="space-y-4">
                <FormSection title="Líneas del Asiento" icon={FileText} />
                <Collection.Root collection={collection}>
                    <Collection.View
                        table={journalEntryLineSheetViews.table}
                        emptyTitle="Sin líneas"
                        emptyDescription="El asiento no tiene líneas."
                    />
                </Collection.Root>
            </section>
        </div>
    )
}

function getJournalEntryLifecycle(entry: JournalEntry): LifecycleStep[] {
    const steps: LifecycleStep[] = [{ id: "origin", label: "Origen", icon: FileText, status: "success" }]

    if (entry.is_manual) {
        steps.push({ id: "draft", label: "Borrador", icon: FileText, status: "active" })
    } else {
        steps.push({ id: "auto", label: "Generado", icon: FileText, status: "success" })
    }

    if (entry.status === "POSTED" || entry.status === "CLOSED" || entry.status === "REVERSAL") {
        steps.push({ id: "posted", label: "Publicado", icon: FileText, status: "success" })
    } else {
        steps.push({ id: "posted", label: "Publicar", icon: FileText, status: "neutral" })
    }

    if (entry.status === "CLOSED") {
        steps.push({ id: "closed", label: "Cerrado", icon: FileText, status: "success" })
    } else if (entry.status === "REVERSAL") {
        steps.push({ id: "reversal", label: "Reversión", icon: FileText, status: "destructive" })
    } else if (entry.status === "POSTED") {
        steps.push({ id: "closed", label: "Cerrar periodo", icon: FileText, status: "neutral" })
    }

    return steps
}

function getSectionActions(
    resolved: ResolvedDocumentAction<JournalEntry>[],
    entryId: number,
    postEntry: (id: number) => Promise<void>,
): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
    const result: Partial<Record<DocumentDomain, DocumentActionItem[]>> = {}
    for (const r of resolved) {
        const domain = r.category as DocumentDomain
        if (domain) {
            ;(result[domain] ??= []).push({
                id: r.action.id,
                label: r.action.label,
                icon: r.action.icon,
                disabled: r.disabled,
                disabledReason: r.disabledReason,
                onClick: () => {
                    if (r.action.id === "post-entry") postEntry(entryId)
                },
            })
        }
    }
    return result
}

function getRowActions(): (link: DocumentLink) => DocumentActionItem[] {
    return () => []
}

// ---------------------------------------------------------------------------
// Internal: form mode (was JournalEntryFormDrawer)
// ---------------------------------------------------------------------------

interface FormContentProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: JournalEntryInitialData
    mode: DrawerMode
    entityId?: number
    onSuccess?: () => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
}

function JournalEntryFormContent({
    open,
    onOpenChange,
    initialData,
    mode,
    entityId,
    onSuccess,
    inline = false,
    onLoadingChange,
}: FormContentProps) {
    const isViewMode = mode === "view"
    const [loading, setLoading] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    useEffect(() => {
        if (onLoadingChange) onLoadingChange(loading)
    }, [loading, onLoadingChange])

    const { isLoading: isAccountsLoading } = useAccounts({ filters: { is_leaf: true } })
    const { serverDate, isLoading: isServerDateLoading } = useServerDate()
    const isFetchingInitialData = open && (isAccountsLoading || isServerDateLoading)

    const { printRef, handlePrint } = usePrintableDrawer()
    const { setEntityDisplay } = useGlobalModalActions()

    useEffect(() => {
        if (entityId) setEntityDisplay(LABEL, Number(entityId), `#${entityId}`)
    }, [entityId, setEntityDisplay])

    const form = useForm<JournalEntryFormValues>({
        resolver: zodResolver(journalEntrySchema),
        defaultValues: initialData
            ? {
                  ...initialData,
                  date: toDate(initialData.date),
                  items: initialData.items.map((item) => ({
                      ...item,
                      account: item.account.toString(),
                      debit: parseFloat(item.debit as unknown as string),
                      credit: parseFloat(item.credit as unknown as string),
                  })),
              }
            : {
                  date: serverDate || new Date(),
                  description: "",
                  items: [
                      { account: "", label: "", debit: 0, credit: 0 },
                      { account: "", label: "", debit: 0, credit: 0 },
                  ],
              },
    })

    useInitializeDrawerForm({
        form,
        open,
        initialData,
        defaultValues: () => ({
            date: serverDate || new Date(),
            description: "",
            items: [
                { account: "", label: "", debit: 0, credit: 0 },
                { account: "", label: "", debit: 0, credit: 0 },
            ],
        }),
        mapData: (data) => ({
            date: toDate(data.date),
            description: data.description,
            items: data.items.map((item) => ({
                account: item.account?.toString() ?? "",
                partner: item.partner?.toString() ?? "",
                label: item.label ?? "",
                debit: Number(item.debit ?? 0),
                credit: Number(item.credit ?? 0),
            })),
        }),
    })

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
                items: data.items.map((i) => ({ ...i, partner: i.partner || null })),
                date: format(data.date, "yyyy-MM-dd"),
                is_manual: true,
            }

            if (initialData?.id) {
                await accountingApi.updateEntry(initialData.id, payload)
                toast.success("Asiento actualizado correctamente")
            } else {
                await accountingApi.createEntry(payload as Record<string, unknown>)
                toast.success("Asiento creado correctamente")
            }

            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            showApiError(error, "Error al guardar el asiento")
        } finally {
            setLoading(false)
        }
    }

    const entryStatus = (initialData as unknown as { status?: string } | undefined)?.status ?? "DRAFT"
    const width = formDrawerWidth("master", !!initialData?.id)
    const formValues = form.watch()

    const identity = useDrawerIdentity(LABEL, mode, initialData as Record<string, unknown> | undefined, {
        overrideTitle: mode === "edit" ? "Editar Asiento" : undefined,
        overrideSubtitle: formValues.description || "Registro manual de movimiento",
        onPrint: handlePrint,
        printable: !!entityId && (mode === "view" || mode === "edit"),
    })

    const formFields = (
        <Form {...form}>
            <form id="journal-entry-form" onSubmit={form.handleSubmit(onSubmit)}>
                <fieldset disabled={isViewMode} className="contents">
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                            <LabeledContainer label="Estado" disabled containerClassName="pointer-events-none">
                                <StatusBadge status={entryStatus} size="sm" variant="badge" />
                            </LabeledContainer>
                        </div>
                        <div className="col-span-3">
                            <LabeledContainer label="Origen" disabled containerClassName="pointer-events-none">
                                <Chip size="xs" intent="neutral">Manual</Chip>
                            </LabeledContainer>
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
                        <div className="col-span-12">
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
                    </div>

                    <FormSection title="Líneas del Asiento" className="space-y-2" />

                    <AccountingLinesTable
                        control={form.control as unknown as Control<FieldValues>}
                        name="items"
                        disabled={isViewMode}
                    />

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
                className="space-y-6 p-6"
                collapsible
                collapseStorageKey="erpgrafico.drawer.sidebar.journal_entry"
                sidebar={entityId ? <EntitySidebar entityType={AUDIT_TYPE} entityId={entityId} /> : undefined}
                showSidebar={!!entityId}
            >
                {formFields}
            </FormSplitLayout>
        </SkeletonShell>
    )

    if (inline) return <>{formContent}</>

    return (
        <>
            {entityId && (
                <PrintableLayout ref={printRef} title="Asiento Contable" displayId={`#${entityId}`}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Descripción:</span>
                            <span>{formValues.description || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>Manual</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Fecha:</span>
                            <span>{formValues.date ? format(formValues.date, "dd/MM/yyyy") : "-"}</span>
                        </div>
                    </div>
                    <div className="text-4xs">
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Cuenta</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                        </div>
                        {(formValues.items ?? []).map((item, idx: number) => (
                            <div key={idx} className="grid grid-cols-[1fr,50px,50px] gap-1 border-b border-dashed py-0.5">
                                <span>{item.account ? item.account.toString() : "-"}</span>
                                <span className="text-right">{Number(item.debit) > 0 ? formatCurrency(Number(item.debit)) : "-"}</span>
                                <span className="text-right">{Number(item.credit) > 0 ? formatCurrency(Number(item.credit)) : "-"}</span>
                            </div>
                        ))}
                    </div>
                </PrintableLayout>
            )}

            <Drawer
                fillContent
                contentClassName="p-0"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={
                    isViewMode ? undefined : (
                        <FormFooter
                            actions={
                                <>
                                    <CancelButton onClick={() => onOpenChange(false)} />
                                    <SubmitButton type="submit" form="journal-entry-form" loading={loading}>
                                        {mode === "create" ? "Crear Asiento" : "Actualizar Asiento"}
                                    </SubmitButton>
                                </>
                            }
                        />
                    )
                }
            >
                {formContent}
            </Drawer>
        </>
    )
}

// ---------------------------------------------------------------------------
// Exported: unified drawer
// ---------------------------------------------------------------------------

export function JournalEntryDrawer({
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
    side = "left",
}: JournalEntryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange ?? setOpenState

    const entityId = (journalEntryId ?? initialData?.id) ?? null

    const { data: fetchedEntry, isLoading: isFetching } = useJournalEntry(
        entityId && !initialData ? entityId : undefined,
    )

    useEffect(() => {
        if (onLoadingChange) onLoadingChange(isFetching)
    }, [isFetching, onLoadingChange])

    const effectiveInitialData = initialData ?? (fetchedEntry as JournalEntryInitialData | undefined)
    const { mode, isView } = useDrawerMode({ mode: modeProp, initialData: effectiveInitialData })

    const showTrigger = openProp === undefined && !isView && (!effectiveInitialData || triggerVariant === "circular")

    return (
        <>
            {showTrigger && (
                <div onClick={() => setOpenState(true)}>
                    {triggerVariant === "circular" ? (
                        <IconButton circular title="Nuevo Asiento" className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90">
                            <Plus className="h-4 w-4" />
                        </IconButton>
                    ) : (
                        <Button variant="default">
                            {triggerText}
                        </Button>
                    )}
                </div>
            )}

            {isView ? (
                <JournalEntryViewContent
                    id={entityId}
                    open={open}
                    onOpenChange={setOpen}
                    onActionSuccess={onSuccess}
                    side={side}
                />
            ) : (
                <JournalEntryFormContent
                    open={open}
                    onOpenChange={setOpen}
                    initialData={effectiveInitialData}
                    mode={mode}
                    entityId={entityId ?? undefined}
                    onSuccess={onSuccess}
                    inline={inline}
                    onLoadingChange={onLoadingChange}
                />
            )}
        </>
    )
}
