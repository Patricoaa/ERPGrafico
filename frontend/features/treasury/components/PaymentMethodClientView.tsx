"use client"

import React, { useState, useEffect } from "react"
import {
    CreditCard, Lock, ChevronDown, Wallet, ArrowRightLeft, HandCoins, Monitor, FileText, CircleSlash, type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DataCell } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataTableView } from '@/components/shared'
import { paymentMethodActions, type PaymentMethodActionsCtx } from './paymentMethodActions'
import { ActivitySidebar } from "@/features/audit"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField } from "@/components/ui/form"
import {
    CancelButton, LabeledInput, LabeledSelect, FormSection, MultiSelectTagInput,
    BaseModal, FormFooter, FormSplitLayout, ActionSlideButton, ActionConfirmModal,
    SmartSearchBar, useClientSearch, useSegmentation, SegmentationBar, Chip
} from "@/components/shared"
import { paymentMethodSearchDef } from "@/features/treasury/searchDef"
import { paymentMethodSegDef } from "@/features/treasury/segmentationDef"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { type Column } from "@tanstack/react-table"
import { usePaymentMethods } from "@/features/treasury/hooks/useMasterData"
import type { PaymentMethod, PaymentMethodCreatePayload, PaymentMethodUpdatePayload } from "@/features/treasury/types"
import { EntityCard } from "@/components/shared"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"

// --- Schema ---

const paymentMethodSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    method_type: z.string().min(1, "El tipo es requerido"),
    treasury_account: z.string().min(1, "La cuenta es requerida"),
    settlement_account: z.string().nullable().optional(),
    requires_reference: z.boolean().default(false),
    allow_for_sales: z.boolean().default(true),
    allow_for_purchases: z.boolean().default(true),
})

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>

// --- Payment Method Management ---

interface PaymentMethodClientViewProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PaymentMethodClientView({ externalOpen, onOpenChange, createAction }: PaymentMethodClientViewProps) {
    const { methods, refetch, deleteMethod } = usePaymentMethods()
    const { filterFn: filterMethods, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<PaymentMethod>(paymentMethodSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(paymentMethodSegDef)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
    const [usageFilter, setUsageFilter] = useState<string[]>([])

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteMethod(id)
        } catch {
            // Error handled by hook
        }
    })

    const handleDelete = (id: number) => {
        deleteConfirm.requestConfirm(id)
    }

    const openEdit = (method: PaymentMethod) => {
        setSelectedMethod(method)
        setDialogOpen(true)
    }

    const paymentMethodActionsCtx: PaymentMethodActionsCtx = {
        onEdit: openEdit,
        onDelete: (id) => handleDelete(id),
    }

    const methodTypeLabels: Record<string, string> = {
        CASH: "Efectivo Directo",
        CARD_TERMINAL: "Tarjeta (Dispositivo Integrado)",
        TRANSFER: "Transferencia Bancaria",
        DEBIT_CARD: "Tarjeta Débito Empresa",
        CREDIT_CARD: "Tarjeta Crédito Empresa",
        CHECK: "Cheque",
    }

    const methodTypeIcons: Record<string, LucideIcon> = {
        CASH: Wallet,
        CARD_TERMINAL: Monitor,
        TRANSFER: ArrowRightLeft,
        DEBIT_CARD: CreditCard,
        CREDIT_CARD: CreditCard,
        CHECK: FileText,
        CARD: CreditCard,
        CREDIT: HandCoins,
        OTHER: CircleSlash,
    }

    const methodTypeIconStyles: Record<string, string> = {
        CASH: "text-success bg-success/10",
        CARD_TERMINAL: "text-info bg-info/10",
        TRANSFER: "text-primary bg-primary/10",
        DEBIT_CARD: "text-warning bg-warning/10",
        CREDIT_CARD: "text-warning bg-warning/10",
        CHECK: "text-muted-foreground bg-muted/50",
        CARD: "text-warning bg-warning/10",
        CREDIT: "text-info bg-info/10",
        OTHER: "text-muted-foreground bg-muted/50",
    }

    const renderMethodCard = (method: PaymentMethod) => {
        const Icon = methodTypeIcons[method.method_type] || CreditCard
        const iconStyle = methodTypeIconStyles[method.method_type] || "text-muted-foreground bg-muted/50"
        return (
            <EntityCard key={method.id} onClick={() => openEdit(method)}>
                <EntityCard.Header
                    icon={Icon}
                    iconClassName={iconStyle}
                    title={method.name}
                    subtitle={
                        <span className="flex items-center gap-1.5 flex-wrap">
                            {method.method_type_display || methodTypeLabels[method.method_type] || method.method_type}
                        </span>
                    }
                    trailing={
                        <div className="flex flex-col gap-0.5 items-end">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Cta. Tesorería</span>
                            <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">{method.treasury_account_name}</span>
                        </div>
                    }
                />
                <EntityCard.Body actions={paymentMethodActions.render(method, paymentMethodActionsCtx)}>
                    <div className="flex items-center gap-2">
                        {method.allow_for_sales && (
                            <Chip size="xs" intent="success">Ventas</Chip>
                        )}
                        {method.allow_for_purchases && (
                            <Chip size="xs" intent="info">Compras</Chip>
                        )}
                    </div>
                </EntityCard.Body>
            </EntityCard>
        )
    }

    const columns = [
        {
            accessorKey: "name",
            header: ({ column }: { column: Column<PaymentMethod, unknown> }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }: { row: { original: PaymentMethod } }) => (
                <div className="flex items-center justify-center gap-2 w-full">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col items-center">
                        <DataCell.Text className="font-medium text-center">{row.original.name}</DataCell.Text>

                    </div>
                </div>
            )
        },
        {
            accessorKey: "method_type_display",
            header: ({ column }: { column: Column<PaymentMethod, unknown> }) => <DataTableColumnHeader column={column} title="Categoría Operativa" className="justify-center" />,
            cell: ({ row }: { row: { original: PaymentMethod } }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text className="text-muted-foreground font-medium text-xs text-center uppercase tracking-tighter">
                        {row.original.method_type_display || methodTypeLabels[row.original.method_type] || row.original.method_type}
                    </DataCell.Text>
                </div>
            )
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }: { column: Column<PaymentMethod, unknown> }) => <DataTableColumnHeader column={column} title="Cuenta de Tesorería" className="justify-center" />,
            cell: ({ row }: { row: { original: PaymentMethod } }) => (
                <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                    <DataCell.Text className="font-normal">{row.original.treasury_account_name}</DataCell.Text>
                    <div className="flex justify-center gap-1">
                        {row.original.allow_for_sales && (
                            <Chip size="xs" intent="success">Ventas</Chip>
                        )}
                        {row.original.allow_for_purchases && (
                            <Chip size="xs" intent="info">Compras</Chip>
                        )}
                    </div>
                </div>
            )
        },
        paymentMethodActions.column(paymentMethodActionsCtx)
    ]

    const isFiltered = isTextFiltered || isSegFiltered || usageFilter.length > 0
    const filteredMethods = React.useMemo(() => {
        let result = methods
        if (segFilters.method_type) result = result.filter(m => m.method_type === segFilters.method_type)
        if (usageFilter.includes('sales')) result = result.filter(m => m.allow_for_sales)
        if (usageFilter.includes('purchases')) result = result.filter(m => m.allow_for_purchases)
        return filterMethods(result)
    }, [methods, segFilters.method_type, usageFilter, filterMethods])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.paymentmethod"
                    columns={columns}
                    data={filteredMethods}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={paymentMethodSearchDef} placeholder="Buscar método de pago..." className="w-full" />}
                    segmentation={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
                                                usageFilter.length > 0
                                                    ? 'bg-accent/50 text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            <span>{usageFilter.length > 0 ? `Disponible (${usageFilter.length})` : 'Disponible'}</span>
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-44">
                                        <DropdownMenuCheckboxItem
                                            checked={usageFilter.includes('sales')}
                                            onCheckedChange={(checked) => {
                                                setUsageFilter(prev => checked ? [...prev, 'sales'] : prev.filter(v => v !== 'sales'))
                                            }}
                                        >
                                            Ventas
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={usageFilter.includes('purchases')}
                                            onCheckedChange={(checked) => {
                                                setUsageFilter(prev => checked ? [...prev, 'purchases'] : prev.filter(v => v !== 'purchases'))
                                            }}
                                        >
                                            Compras
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <SegmentationBar def={paymentMethodSegDef} />
                        </div>
                    }
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg(); setUsageFilter([]) }}
                    createAction={createAction}
                    renderCard={renderMethodCard}
                />
            </div>

            <PaymentMethodModal
                open={dialogOpen || !!externalOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) {
                        setSelectedMethod(null)
                        onOpenChange?.(false)
                    } else {
                        setDialogOpen(true)
                    }
                }}
                method={selectedMethod}
                onSuccess={() => {
                    setDialogOpen(false)
                    onOpenChange?.(false)
                    refetch()
                }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Método de Pago"
                description="¿Está seguro de eliminar este método de pago? Esta acción no se puede deshacer."
                variant="destructive"
            />
        </div>
    )
}

interface PaymentMethodModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    method: PaymentMethod | null
    onSuccess: () => void
}

function PaymentMethodModal({ open, onOpenChange, method, onSuccess }: PaymentMethodModalProps) {
    const { createMethod, updateMethod, isCreating, isUpdating } = usePaymentMethods()
    const isSaving = isCreating || isUpdating

    const [showAdvanced, setShowAdvanced] = useState(false)

    const form = useForm<PaymentMethodFormValues>({
        resolver: zodResolver(paymentMethodSchema) as unknown as Resolver<PaymentMethodFormValues>,
        defaultValues: {
            name: "",
            method_type: "DEBIT_CARD",
            treasury_account: "",
            settlement_account: null,
            requires_reference: false,
            allow_for_sales: true,
            allow_for_purchases: true,
        },
    })

    useEffect(() => {
        if (open) {
            setShowAdvanced(false)
            const acc = method?.treasury_account
            const accountId = acc ? (typeof acc === 'object' ? (acc as unknown as { id: number }).id.toString() : acc.toString()) : ""
            const settlementAcc = method?.settlement_account
            const settlementId = settlementAcc ? (typeof settlementAcc === 'object' ? (settlementAcc as unknown as { id: number }).id.toString() : settlementAcc.toString()) : null

            form.reset({
                name: method?.name || "",
                method_type: method?.method_type || "DEBIT_CARD",
                treasury_account: accountId,
                settlement_account: settlementId,
                requires_reference: method?.requires_reference || false,
                allow_for_sales: method?.allow_for_sales ?? true,
                allow_for_purchases: method?.allow_for_purchases ?? true,
            })
        }
    }, [open, method, form])

    // Al crear, el uso (ventas/compras) se deriva del tipo; el usuario no está obligado
    // a configurarlo (queda en "Avanzado"). Débito/crédito empresa → solo compras;
    // terminal → solo ventas; resto → ambos.
    const watchedType = form.watch("method_type")
    useEffect(() => {
        if (method) return // editar: respetar lo guardado
        if (watchedType === "DEBIT_CARD" || watchedType === "CREDIT_CARD") {
            form.setValue("allow_for_sales", false)
            form.setValue("allow_for_purchases", true)
        } else if (watchedType === "CARD_TERMINAL") {
            form.setValue("allow_for_sales", true)
            form.setValue("allow_for_purchases", false)
        } else {
            form.setValue("allow_for_sales", true)
            form.setValue("allow_for_purchases", true)
        }
    }, [watchedType, method, form])

    const onSubmit = async (data: PaymentMethodFormValues) => {
        try {
            if (method) {
                await updateMethod({ id: method.id, payload: data as unknown as PaymentMethodUpdatePayload })
            } else {
                await createMethod(data as unknown as PaymentMethodCreatePayload)
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
            size={method ? "xl" : "md"}
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span>{method ? "Ficha de Método de Pago" : "Nuevo Método de Pago"}</span>
                </div>
            }
            description={method ? "Modifique el método de pago y revise su historial." : "Defina el método de pago vinculado a una cuenta de tesorería."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                type="submit"
                                form="method-form"
                                loading={isSaving}
                                disabled={isSaving}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                {method ? "Guardar Cambios" : "Crear Método"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                showSidebar={!!method?.id}
                sidebar={
                    method?.id && (
                        <ActivitySidebar
                            entityType="paymentmethod"
                            entityId={method.id}
                            title="Historial"
                        />
                    )
                }
            >
                <Form {...form}>
                    <form id="method-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
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
                                            placeholder="Ej: Visa Santander Debito"
                                            {...field}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="method_type"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Tipo"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldState.error?.message}
                                            options={[
                                                { value: "CASH", label: "Efectivo Directo" },
                                                { value: "CARD_TERMINAL", label: "Tarjeta (Dispositivo Integrado)" },
                                                { value: "TRANSFER", label: "Transferencia Bancaria" },
                                                { value: "DEBIT_CARD", label: "Tarjeta Débito Empresa" },
                                                { value: "CREDIT_CARD", label: "Tarjeta Crédito Empresa" },
                                                { value: "CHECK", label: "Cheque" },
                                            ]}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="treasury_account"
                                    render={({ field, fieldState }) => (
                                        <TreasuryAccountSelector
                                            label="Cuenta de tesorería"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="settlement_account"
                                    render={({ field, fieldState }) => (
                                        <TreasuryAccountSelector
                                            label="Cuenta de liquidación (destino real)"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldState.error?.message}
                                            disabled={watchedType === "CARD_TERMINAL"}
                                        />
                                    )}
                                />
                                {watchedType !== "CARD_TERMINAL" && (
                                    <p className="text-[9px] text-muted-foreground italic mt-1">Cuenta destino contable real. Para terminales integrados se auto-gestiona desde el proveedor.</p>
                                )}
                                {watchedType === "CARD_TERMINAL" && (
                                    <p className="text-[9px] text-muted-foreground italic mt-1">Gestionado automáticamente por el proveedor del terminal.</p>
                                )}
                            </div>

                            <div className="col-span-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced((v) => !v)}
                                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
                                    Avanzado · Permisos de uso
                                </button>
                                {!showAdvanced && (
                                    <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                                        Por defecto se deriva del tipo. Ábrelo solo si necesitas restringir ventas/compras.
                                    </p>
                                )}
                                {showAdvanced && (
                                    <div className="pt-3">
                                        <FormSection title="Permisos de Uso" icon={Lock} />
                                        <FormField
                                            control={form.control}
                                            name="allow_for_sales"
                                            render={() => (
                                                <div className="pt-2">
                                                    <MultiSelectTagInput
                                                        label="Habilitado para"
                                                        options={[
                                                            { label: "Ventas", value: "sales" },
                                                            { label: "Compras", value: "purchases" }
                                                        ]}
                                                        value={[
                                                            ...(form.watch("allow_for_sales") ? ["sales"] : []),
                                                            ...(form.watch("allow_for_purchases") ? ["purchases"] : [])
                                                        ]}
                                                        onChange={(vals) => {
                                                            form.setValue("allow_for_sales", vals.includes("sales"))
                                                            form.setValue("allow_for_purchases", vals.includes("purchases"))
                                                        }}
                                                        placeholder="Defina dónde se permite este método..."
                                                    />
                                                </div>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
    )
}
