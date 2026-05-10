"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Plus, Pencil, FileText, Calendar, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LabeledInput } from "@/components/shared"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { BaseModal } from "@/components/shared/BaseModal"

import { BudgetEditor } from "@/features/finance/components/BudgetEditor"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"

import { useSearchParams, usePathname } from "next/navigation"

interface BudgetsListViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useBudgets, type Budget } from "@/features/finance/hooks/useBudgets"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

export function BudgetsListView({ externalOpen, onExternalOpenChange, createAction }: BudgetsListViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { budgets, refetch, createBudget } = useBudgets()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Budget>({
        endpoint: '/accounting/budgets'
    })

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newBudget, setNewBudget] = useState({
        name: "",
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
        description: ""
    })

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

    // Open edit form if ?selected= is present (ADR-0020)
    useEffect(() => {
        if (selectedFromUrl && (!isEditorOpen || budgetToEdit?.id !== selectedFromUrl.id)) {
            setBudgetToEdit(selectedFromUrl)
            setIsEditorOpen(true)
        }
    }, [selectedFromUrl, isEditorOpen, budgetToEdit])

    const handleCreate = async () => {
        try {
            await createBudget(newBudget)
            setIsCreateOpen(false)
            handleCreateOpenChange(false)
            setNewBudget({ name: "", start_date: "", end_date: "", description: "" })
        } catch {
            // Error handled by hook toast
        }
    }

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
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(item.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
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

            {/* Create Modal */}
            <BaseModal
                open={isCreateOpen}
                onOpenChange={handleCreateOpenChange}
                size="md"
                title="Crear Nuevo Presupuesto"
                footer={
                    <Button onClick={handleCreate} className="w-full">Crear Presupuesto Anual</Button>
                }
            >
                <div className="space-y-4">
                    <LabeledInput
                        label="Nombre o Referencia"
                        value={newBudget.name}
                        onChange={e => setNewBudget({ ...newBudget, name: e.target.value })}
                        placeholder="Ej: Presupuesto Operativo"
                    />
                    <div>
                        <LabeledInput
                            label="Año del Presupuesto"
                            type="number"
                            min={2020}
                            max={2100}
                            defaultValue={new Date().getFullYear()}
                            onChange={e => {
                                const year = e.target.value
                                setNewBudget({
                                    ...newBudget,
                                    name: newBudget.name || `Presupuesto ${year}`,
                                    start_date: `${year}-01-01`,
                                    end_date: `${year}-12-31`
                                })
                            }}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Los presupuestos se restringen obligatoriamente a un año completo (01 Ene - 31 Dic).</p>
                    </div>
                    <LabeledInput
                        label="Descripción"
                        value={newBudget.description}
                        onChange={e => setNewBudget({ ...newBudget, description: e.target.value })}
                    />
                </div>
            </BaseModal>

            {/* Editor Modal */}
            {budgetToEdit && (
                <BudgetEditor
                    open={isEditorOpen}
                    onOpenChange={(open) => {
                        setIsEditorOpen(open)
                        if (!open) {
                            setBudgetToEdit(null)
                            clearSelection()
                        }
                    }}
                    budget={budgetToEdit}
                    onSave={() => {
                        refetch() // Optional: refresh if metadata changes, mostly for consistency
                        toast.success("Presupuesto actualizado")
                    }}
                />
            )}
        </div>
    )
}
