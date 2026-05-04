"use client"

import React, { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
    Plus, Edit, Trash2, Loader2, CreditCard, Landmark, List, History, Tag, Pencil, Lock
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import api from "@/lib/api"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField } from "@/components/ui/form"
import {
    CancelButton, LabeledInput, LabeledSelect, FormSection, MultiSelectTagInput,
    BaseModal, FormFooter, FormSplitLayout, ActionSlideButton, ActionConfirmModal
} from "@/components/shared"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { Column } from "@tanstack/react-table";

// --- Schemas ---

const bankSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().nullable().optional(),
    swift_code: z.string().max(11, "Máximo 11 caracteres").nullable().optional(),
})

type BankFormValues = z.infer<typeof bankSchema>

const paymentMethodSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    method_type: z.string().min(1, "El tipo es requerido"),
    treasury_account: z.string().min(1, "La cuenta es requerida"),
    requires_reference: z.boolean().default(false),
    allow_for_sales: z.boolean().default(true),
    allow_for_purchases: z.boolean().default(true),
})

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>

// --- Bank Management ---

interface Bank {
    id: number
    name: string
    code: string | null
    swift_code?: string | null
    is_active: boolean
}

interface BankManagementProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function BankManagement({ externalOpen, onOpenChange, createAction }: BankManagementProps) {
    const [banks, setBanks] = useState<Bank[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)

    const fetchBanks = async () => {
        setLoading(true)
        try {
            const response = await api.get("/treasury/banks/")
            setBanks(response.data)
        } catch (error) {
            toast.error("Error al cargar bancos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        requestAnimationFrame(() => fetchBanks())
    }, [])

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/treasury/banks/${id}/`)
            toast.success("Banco eliminado")
            fetchBanks()
        } catch (error) {
            toast.error("Error al eliminar banco")
        }
    })

    const handleDelete = (id: number) => {
        deleteConfirm.requestConfirm(id)
    }

    const openCreate = () => {
        setSelectedBank(null)
        setDialogOpen(true)
    }

    const openEdit = (bank: Bank) => {
        setSelectedBank(bank)
        setDialogOpen(true)
    }

    const columns = [
        {
            accessorKey: "name",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => (
                <div className="flex items-center justify-center gap-2 w-full">
                    <DataCell.Text className="font-medium text-center">
                        <Landmark className="h-4 w-4 text-muted-foreground mr-2 inline" />
                        {row.original.name}
                    </DataCell.Text>
                </div>
            )
        },
        {
            accessorKey: "code",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Code>{row.original.code || 'N/A'}</DataCell.Code>
                </div>
            )
        },
        createActionsColumn<Bank>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => openEdit(item)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                    />
                </>
            )
        })
    ]

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-primary/10 hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Landmark className="h-5 w-5" /> Gestión de Bancos
                    </h2>
                    <p className="text-sm text-muted-foreground">Administre las entidades bancarias globales.</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={banks}
                cardMode
                isLoading={loading}
                searchPlaceholder="Buscar bancos..."
                filterColumn="name"
                useAdvancedFilter={true}
                createAction={createAction}
            />

            <BankModal
                open={dialogOpen || !!externalOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) {
                        setSelectedBank(null)
                        onOpenChange?.(false)
                    } else {
                        setDialogOpen(true)
                    }
                }}
                bank={selectedBank}
                onSuccess={() => {
                    setDialogOpen(false)
                    onOpenChange?.(false)
                    fetchBanks()
                }}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Banco"
                description="¿Está seguro de eliminar este banco? Esta acción no se puede deshacer."
                variant="destructive"
            />
        </div>
    )
}

interface BankModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    bank: Bank | null
    onSuccess: () => void
}

function BankModal({ open, onOpenChange, bank, onSuccess }: BankModalProps) {
    const [loading, setLoading] = useState(false)

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
        setLoading(true)
        try {
            if (bank) {
                await api.patch(`/treasury/banks/${bank.id}/`, data)
                toast.success("Banco actualizado")
            } else {
                await api.post("/treasury/banks/", data)
                toast.success("Banco creado")
            }
            onSuccess()
        } catch (error) {
            toast.error("Error al guardar banco")
        } finally {
            setLoading(false)
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
                            <ActionSlideButton
                                type="submit"
                                form="bank-form"
                                loading={loading}
                                disabled={loading}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                {bank ? "Guardar Cambios" : "Crear Banco"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                showSidebar={!!bank?.id}
                sidebar={
                    bank?.id && (
                        <ActivitySidebar
                            entityType="bank"
                            entityId={bank.id}
                            title="Historial"
                        />
                    )
                }
            >
                <Form {...form}>
                    <form id="bank-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-2">
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

// --- Payment Method Management ---

interface PaymentMethod {
    id: number
    name: string
    method_type: string
    method_type_display: string
    treasury_account: number | { id: number; name?: string }
    treasury_account_name: string
    is_active: boolean
    requires_reference: boolean
    allow_for_sales: boolean
    allow_for_purchases: boolean
    is_terminal_integration?: boolean
}

interface PaymentMethodManagementProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PaymentMethodManagement({ externalOpen, onOpenChange, createAction }: PaymentMethodManagementProps) {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

    const fetchMethods = async () => {
        setLoading(true)
        try {
            const response = await api.get("/treasury/payment-methods/")
            setMethods(response.data)
        } catch (error) {
            toast.error("Error al cargar métodos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        requestAnimationFrame(() => fetchMethods())
    }, [])

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/treasury/payment-methods/${id}/`)
            toast.success("Método eliminado")
            fetchMethods()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    })

    const handleDelete = (id: number) => {
        deleteConfirm.requestConfirm(id)
    }

    const openCreate = () => {
        setSelectedMethod(null)
        setDialogOpen(true)
    }

    const openEdit = (method: PaymentMethod) => {
        setSelectedMethod(method)
        setDialogOpen(true)
    }

    const methodTypeLabels: Record<string, string> = {
        CASH: "Efectivo Directo",
        CARD_TERMINAL: "Tarjeta (Dispositivo Integrado)",
        TRANSFER: "Transferencia Bancaria",
        DEBIT_CARD: "Tarjeta Débito Empresa",
        CREDIT_CARD: "Tarjeta Crédito Empresa",
        CHECK: "Cheque",
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
                    <DataCell.Secondary className="text-center">{row.original.treasury_account_name}</DataCell.Secondary>
                    <div className="flex justify-center gap-1">
                        {row.original.allow_for_sales && (
                            <DataCell.Badge
                                variant="outline"
                                className="text-[10px] px-1 h-3.5 bg-income/5 text-income border-income/10 font-black uppercase tracking-tighter" // intentional: badge density
                            >
                                Ventas
                            </DataCell.Badge>
                        )}
                        {row.original.allow_for_purchases && (
                            <DataCell.Badge
                                variant="outline"
                                className="text-[10px] px-1 h-3.5 bg-asset/5 text-asset border-asset/10 font-black uppercase tracking-tighter" // intentional: badge density
                            >
                                Compras
                            </DataCell.Badge>
                        )}
                    </div>
                </div>
            )
        },
        createActionsColumn<PaymentMethod>({
            renderActions: (item) => (
                item.is_terminal_integration ? (
                    <DataCell.Action
                        icon={Lock}
                        title="Gestionado por terminal — modifique el dispositivo"
                        onClick={() => { }}
                        className="text-muted-foreground cursor-default opacity-50"
                    />
                ) : (
                    <>
                        <DataCell.Action
                            icon={Pencil}
                            title="Editar"
                            onClick={() => openEdit(item)}
                        />
                        <DataCell.Action
                            icon={Trash2}
                            title="Eliminar"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                        />
                    </>
                )
            )
        })
    ]

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-primary/10 hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Métodos de Pago
                    </h2>
                    <p className="text-sm text-muted-foreground">Configure los métodos de pago habilitados por cuenta.</p>
                </div>
                <Button onClick={openCreate} className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Método
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={methods}
                cardMode
                isLoading={loading}
                searchPlaceholder="Buscar por nombre o cuenta..."
                filterColumn="name"
                useAdvancedFilter={true}
                createAction={createAction}
            />

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
                    fetchMethods()
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
    const [loading, setLoading] = useState(false)

    const form = useForm<PaymentMethodFormValues>({
        resolver: zodResolver(paymentMethodSchema),
        defaultValues: {
            name: "",
            method_type: "DEBIT_CARD",
            treasury_account: "",
            requires_reference: false,
            allow_for_sales: true,
            allow_for_purchases: true,
        },
    })

    useEffect(() => {
        if (open) {
            const acc = method?.treasury_account
            const accountId = acc ? (typeof acc === 'object' ? (acc as any).id.toString() : acc.toString()) : ""

            form.reset({
                name: method?.name || "",
                method_type: method?.method_type || "DEBIT_CARD",
                treasury_account: accountId,
                requires_reference: method?.requires_reference || false,
                allow_for_sales: method?.allow_for_sales ?? true,
                allow_for_purchases: method?.allow_for_purchases ?? true,
            })
        }
    }, [open, method, form])

    const onSubmit = async (data: PaymentMethodFormValues) => {
        setLoading(true)
        try {
            if (method) {
                await api.patch(`/treasury/payment-methods/${method.id}/`, data)
                toast.success("Método actualizado")
            } else {
                await api.post("/treasury/payment-methods/", data)
                toast.success("Método creado")
            }
            onSuccess()
        } catch (error) {
            toast.error("Error al guardar método")
        } finally {
            setLoading(false)
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
                                loading={loading}
                                disabled={loading}
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
                    <form id="method-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-2">
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

                            <div className="col-span-4">
                                <FormSection title="Permisos de Uso" icon={Lock} />
                                <FormField
                                    control={form.control}
                                    name="allow_for_sales"
                                    render={({ field }) => (
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
                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
    )
}


