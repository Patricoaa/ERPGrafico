"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Pencil, FileText, Calendar, Wallet } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { BaseModal } from "@/components/shared/BaseModal"
import { EntityForm } from "@/components/shared/EntityForm"

import { BudgetEditor } from "@/features/finance/components/BudgetEditor"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"

import { useSearchParams, usePathname } from "next/navigation"

interface BudgetsListViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useBudgets, type Budget } from "@/features/finance/hooks/useBudgets"

export function BudgetsListView({ externalOpen, onExternalOpenChange, createAction }: BudgetsListViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { budgets, refetch } = useBudgets()

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
    }

    // Synchronize external modal trigger
    useEffect(() => {
        if (externalOpen) {
            setIsCreateOpen(true)
        }
    }, [externalOpen])

    const handleCreateOpenChange = (open: boolean) => {
        setIsCreateOpen(open)
        if (!open) {
            onExternalOpenChange?.(false)
            handleCloseModal()
        }
    }

    // Edit Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null)

    const columns: ColumnDef<Budget>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <Link
                        href={`/finances/budgets/${row.original.id}`}
                        className="font-medium hover:underline text-primary flex items-center gap-2"
                    >
                        <Wallet className="h-4 w-4" />
                        {row.getValue("name")}
                    </Link>
                    {row.original.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {row.original.description}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Periodo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2 text-muted-foreground w-full">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                        {row.original.start_date} - {row.original.end_date}
                    </span>
                </div>
            ),
        },
        createActionsColumn<Budget>({
            renderActions: (item) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar Montos"
                        onClick={() => {
                            setBudgetToEdit(item)
                            setIsEditorOpen(true)
                        }}
                    />
                    <DataCell.Action
                        icon={FileText}
                        title="Ver Ejecución"
                        onClick={() => {
                            router.push(`/finances/budgets/${item.id}`)
                        }}
                    />
                </>
            )
        }),
    ]

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={budgets}
                cardMode
                globalFilterFields={["name"]}
                searchPlaceholder="Buscar presupuestos..."
                useAdvancedFilter={true}
                createAction={createAction}
            />

            {/* Create Modal — driven by EntityForm (T-34) */}
            <BaseModal
                open={isCreateOpen}
                onOpenChange={handleCreateOpenChange}
                size="md"
                title="Crear Nuevo Presupuesto"
            >
                <EntityForm
                    modelLabel="accounting.budget"
                    apiBasePath="/accounting/budgets/"
                    onSuccess={() => {
                        refetch()
                        handleCreateOpenChange(false)
                    }}
                    onCancel={() => handleCreateOpenChange(false)}
                />
            </BaseModal>

            {/* Editor Modal */}
            {budgetToEdit && (
                <BudgetEditor
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    budget={budgetToEdit}
                    onSave={() => {
                        refetch()
                    }}
                />
            )}
        </div>
    )
}
