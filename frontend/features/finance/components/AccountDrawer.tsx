"use client"

import { useState, useEffect, useRef } from "react"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Printer } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAccountMutations } from "@/features/accounting"
import { type AccountPayload } from "@/features/accounting/types"
import { Drawer, LabeledInput, LabeledSelect, FormFooter, CancelButton, FormSplitLayout, ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components"
import { formDrawerWidth } from "@/lib/form-widths"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useReactToPrint } from "react-to-print"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

const accountSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    parent: z.string().optional().or(z.literal("")),
})

type AccountFormValues = z.infer<typeof accountSchema>

interface AccountDrawerProps {
    auditSidebar?: React.ReactNode
    onSuccess?: () => void
    accounts?: Record<string, unknown>[]
    initialData?: Record<string, unknown>
    parentId?: string
    triggerText?: React.ReactNode
    triggerVariant?: "default" | "circular"
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
}

export function AccountDrawer({
    onSuccess,
    accounts = [],
    initialData,
    parentId,
    triggerText = "Nueva Cuenta",
    triggerVariant = "default",
    open: openProp,
    onOpenChange,
    inline = false,
    onLoadingChange,
    mode: modeProp,
}: AccountDrawerProps) {
    const mode = modeProp ?? (initialData?.id ? 'view' : 'create')
    const isViewMode = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })
    const [internalOpen, setInternalOpen] = useState(false)
    const open = openProp !== undefined ? openProp : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const { createAccount, updateAccount, isCreating, isUpdating } = useAccountMutations()
    const loading = isCreating || isUpdating

    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(loading)
        }
    }, [loading, onLoadingChange])

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            code: initialData?.code as string || "",
            name: initialData?.name as string || "",
            account_type: (initialData?.account_type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE") || "ASSET",
            parent: (typeof initialData?.parent === 'object' ? String((initialData.parent as Record<string, unknown>).id ?? '') : String(initialData?.parent ?? '')) || parentId || undefined,
        },
    })

    const width = formDrawerWidth("medium", !!initialData?.id)

    const isEditMode = !!initialData?.id
    const init = initialData as Record<string, unknown> | undefined
    const hasParent = isEditMode && !!init?.parent
    const hasPostedItems = isEditMode && !!init?.has_posted_items
    const hasChildren = isEditMode && !init?.is_selectable

    const accountType = form.watch("account_type");

    // Reset form when opening or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    code: initialData.code as string,
                    name: initialData.name as string,
                    account_type: initialData.account_type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
                    parent: (typeof initialData.parent === 'object' ? String((initialData.parent as Record<string, unknown>).id ?? '') : String(initialData.parent ?? '')) || undefined,
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    account_type: "ASSET",
                    parent: parentId || undefined,
                })
            }
        }
    }, [open, initialData, form])

    // Effect to handle parent changes: Update account_type and suggest categories
    const watchParentId = form.watch("parent")
    useEffect(() => {
        if (!watchParentId || watchParentId === "__none__" || watchParentId === "none") return;

        const parent = accounts.find((a: Record<string, unknown>) => String(a.id) === watchParentId.toString());
        if (parent) {
            form.setValue("account_type", parent.account_type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE");
        }
    }, [watchParentId, accounts, form])

    async function onSubmit(data: AccountFormValues) {
        try {
            const payload: AccountPayload = {
                code: data.code || "",
                name: data.name,
                account_type: data.account_type,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? Number(data.parent) : null,
            };

            if (initialData?.id) {
                await updateAccount({ id: initialData.id as number, payload })
            } else {
                await createAccount(payload)
            }

            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error) {
            showApiError(error, "Error al guardar la cuenta")
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null; // Controlled mode might not need internal trigger

        return triggerVariant === "circular" ? (
            <Button size="icon" className="rounded-full h-8 w-8" title="Crear Cuenta Contable" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
            </Button>
        ) : (
            <Button variant={initialData ? "ghost" : "default"} size={initialData ? "sm" : "default"} onClick={() => setOpen(true)}>
                {triggerText}
            </Button>
        )
    }

    const formFields = (
        <Form {...form}>
            <form id="account-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <LabeledInput
                            label="Código"
                            placeholder="Auto"
                            disabled={true}
                            hint="Jerárquico"
                            {...field}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field, fieldState }) => (
                        <LabeledInput
                            label="Nombre"
                            required
                            placeholder="Ej: Caja Chica"
                            error={fieldState.error?.message}
                            disabled={isViewMode}
                            {...field}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="account_type"
                    render={({ field, fieldState }) => (
                        <LabeledSelect
                            label="Tipo de Cuenta"
                            required
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldState.error?.message}
                            disabled={isViewMode || hasParent || hasPostedItems || hasChildren || (!!parentId && parentId !== "__none__" && parentId !== "none")}
                            options={[
                                { value: "ASSET", label: "Activo" },
                                { value: "LIABILITY", label: "Pasivo" },
                                { value: "EQUITY", label: "Patrimonio" },
                                { value: "INCOME", label: "Ingreso" },
                                { value: "EXPENSE", label: "Gasto" },
                            ]}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="parent"
                    render={({ field, fieldState }) => (
                        <AccountSelector
                            label="Cuenta Padre (opcional)"
                            value={field.value}
                            onChange={field.onChange}
                            showAll={true}
                            placeholder="Sin padre (Raíz)"
                            error={fieldState.error?.message}
                            disabled={isViewMode || hasPostedItems || hasChildren}
                        />
                    )}
                />
            </form>
        </Form>
    )

    const formContent = (
        <FormSplitLayout
            sidebar={initialData?.id ? (
                <ActivitySidebar entityType="account" entityId={initialData.id as number} />
            ) : undefined}
            showSidebar={!!initialData?.id}
        >
            {formFields}
        </FormSplitLayout>
    )

    if (inline) {
        return <>{formContent}</>
    }

    const identity = useDrawerIdentity('accounting.account', mode, initialData as Record<string, unknown> | undefined, {
        customTitle: isViewMode ? `Ficha de Cuenta #${initialData?.id}` : undefined,
        subtitle: isViewMode
            ? `${(initialData?.code as string) || ""} • ${form.watch("name") || "Vista de detalle"}`
            : `${(initialData?.code as string) || ""} • ${form.watch("name") || "Plan de Cuentas • Contabilidad General"}`,
    })

    return (
        <>
            {!isViewMode && <Trigger />}
            {(isViewMode || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="Comprobante Contable"
                    displayId={(initialData?.code as string) || `#${initialData.id}`}
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
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>{(initialData?.account_type as string) ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                icon={identity.icon}
                title={identity.title}
                headerActions={(mode === 'view' || mode === 'edit') && !!initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={identity.subtitle}
                mode={mode}
                footer={isViewMode ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="account-form" loading={loading}>
                                    {mode === 'create' ? "Crear Cuenta" : "Guardar Cambios"}
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
