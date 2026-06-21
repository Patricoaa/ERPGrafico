"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Landmark } from "lucide-react"
import { DataCell } from '@/components/shared'
import { bankActions, type BankActionsCtx } from './bankActions'
import { ActivitySidebar } from "@/features/audit/components"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField } from "@/components/ui/form"
import {
    CancelButton, LabeledInput,
    BaseModal, FormFooter, FormSplitLayout, ActionSlideButton, ActionConfirmModal,
    SmartSearchBar, useClientSearch, useSegmentation, SegmentationBar, Chip
} from "@/components/shared"
import { bankSearchDef } from "@/features/treasury/searchDef"
import { bankSegDef } from "@/features/treasury/segmentationDef"
import { Column } from "@tanstack/react-table";
import { useBanks } from "@/features/treasury/hooks/useMasterData"
import { useAllBanksOverview } from "@/features/treasury/hooks/useAllBanksOverview"
import type { Bank } from "@/features/treasury/types"
import { BankCreationWizard } from "./BankCreationWizard"

// --- Schemas ---

const bankSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().nullable().optional(),
    swift_code: z.string().max(11, "Máximo 11 caracteres").nullable().optional(),
})

type BankFormValues = z.infer<typeof bankSchema>

// --- Bank Management ---

interface BankManagementProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function BankManagement({ externalOpen, onOpenChange, createAction }: BankManagementProps) {
    const { banks, refetch, archiveBank, restoreBank } = useBanks()
    const { overviews } = useAllBanksOverview()
    const { filterFn: filterBanks, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<Bank>(bankSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(bankSegDef)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [wizardOpen, setWizardOpen] = useState(false)
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
    const router = useRouter()

    const archiveConfirm = useConfirmAction<number>(async (id) => {
        try {
            await archiveBank(id)
        } catch {
            // Error handled by hook
        }
    })

    const restoreConfirm = useConfirmAction<number>(async (id) => {
        try {
            await restoreBank(id)
        } catch {
            // Error handled by hook
        }
    })

    const handleArchive = (id: number) => {
        archiveConfirm.requestConfirm(id)
    }

    const handleRestore = (id: number) => {
        restoreConfirm.requestConfirm(id)
    }

    const openCreate = () => {
        setSelectedBank(null)
        setWizardOpen(true)
    }

    const openEdit = (bank: Bank) => {
        setSelectedBank(bank)
        setDialogOpen(true)
    }

    const bankActionsCtx: BankActionsCtx = {
        onView: (id) => router.push(`/treasury/centro-bancos/${id}/overview`),
        onEdit: openEdit,
        onArchive: (id) => archiveConfirm.requestConfirm(id),
        onRestore: (id) => restoreConfirm.requestConfirm(id),
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
        {
            id: "accounts",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Cuentas" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => {
                const overview = overviews.find(o => o.bank.id === row.original.id)
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>{overview?.summary.total_accounts ?? 0}</DataCell.Text>
                    </div>
                )
            },
            accessorFn: (row: Bank) => overviews.find(o => o.bank.id === row.id)?.summary.total_accounts ?? 0,
        },
        {
            id: "cards",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Tarjetas" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => {
                const overview = overviews.find(o => o.bank.id === row.original.id)
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>{overview?.summary.card_count ?? 0}</DataCell.Text>
                    </div>
                )
            },
            accessorFn: (row: Bank) => overviews.find(o => o.bank.id === row.id)?.summary.card_count ?? 0,
        },
        {
            id: "checks",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Cheques" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => {
                const overview = overviews.find(o => o.bank.id === row.original.id)
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>{overview?.summary.issued_checks ?? 0}</DataCell.Text>
                    </div>
                )
            },
            accessorFn: (row: Bank) => overviews.find(o => o.bank.id === row.id)?.summary.issued_checks ?? 0,
        },
        {
            id: "loans",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Préstamos" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => {
                const overview = overviews.find(o => o.bank.id === row.original.id)
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Text>{overview?.summary.active_loan_count ?? 0}</DataCell.Text>
                    </div>
                )
            },
            accessorFn: (row: Bank) => overviews.find(o => o.bank.id === row.id)?.summary.active_loan_count ?? 0,
        },
        {
            id: "is_active",
            header: ({ column }: { column: Column<Bank, unknown> }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }: { row: { original: Bank } }) => (
                <div className="flex justify-center w-full">
                    {row.original.is_active ? (
                        <Chip size="xs" intent="success">Activo</Chip>
                    ) : (
                        <Chip size="xs" intent="neutral">Archivado</Chip>
                    )}
                </div>
            ),
            accessorFn: (row: Bank) => (row.is_active ? "Activo" : "Archivado"),
        },
        bankActions.column(bankActionsCtx)
    ]

    const isFiltered = isTextFiltered || isSegFiltered
    const filteredBanks = React.useMemo(() => {
        let result = banks
        if (segFilters.is_active === 'true') result = result.filter(b => b.is_active)
        else if (segFilters.is_active === 'false') result = result.filter(b => !b.is_active)
        return filterBanks(result)
    }, [banks, segFilters.is_active, filterBanks])

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-md border border-primary/10 hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Landmark className="h-5 w-5" /> Gestión de Bancos
                    </h2>
                    <p className="text-sm text-muted-foreground">Administre las entidades bancarias globales.</p>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={filteredBanks}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={bankSearchDef} placeholder="Buscar banco..." className="w-full" />}
                    segmentation={<SegmentationBar def={bankSegDef} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    createAction={createAction}
                />
            </div>

            <BankCreationWizard
                open={wizardOpen || (!!externalOpen && !selectedBank)}
                onOpenChange={(open: boolean) => {
                    setWizardOpen(open)
                    if (!open) {
                        onOpenChange?.(false)
                    }
                }}
                onSuccess={() => {
                    refetch()
                }}
            />

            <BankModal
                open={dialogOpen || (!!externalOpen && !!selectedBank)}
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
                    refetch()
                }}
            />

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title="Archivar Banco"
                description="El banco quedará inactivo y no aparecerá en los selectores. Podrá restaurarlo en cualquier momento."
                variant="warning"
            />
            <ActionConfirmModal
                open={restoreConfirm.isOpen}
                onOpenChange={(open) => { if (!open) restoreConfirm.cancel() }}
                onConfirm={restoreConfirm.confirm}
                title="Restaurar Banco"
                description="¿Desea reactivar este banco? Volverá a estar disponible en los selectores."
                variant="info"
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
                            <ActionSlideButton
                                type="submit"
                                form="bank-form"
                                loading={isSaving}
                                disabled={isSaving}
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


