"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Calendar, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BaseModal, CancelButton, FormFooter, LabeledInput } from '@/components/shared'
import { toast } from "sonner"
import { DataTableView, DataTableColumnHeader } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"

import { BudgetEditor } from "@/features/finance/components/BudgetEditor"
import { DataCell } from '@/components/shared'
import { budgetActions, type BudgetActionsCtx } from "@/features/finance/budgetActions"

import { useSearchParams, usePathname } from "next/navigation"

interface BudgetsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useBudgets, type Budget } from "@/features/finance/hooks/useBudgets"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useServerDate } from '@/hooks/useServerDate'

export function BudgetsClientView({ externalOpen, onExternalOpenChange, createAction }: BudgetsClientViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { budgets, isLoading, refetch, createBudget } = useBudgets()
    const { serverDate } = useServerDate()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Budget>({
        endpoint: '/accounting/budgets'
    })

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newBudget, setNewBudget] = useState({
        name: "",
        start_date: `${(serverDate ?? new Date()).getFullYear()}-01-01`,
        end_date: `${(serverDate ?? new Date()).getFullYear()}-12-31`,
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
            requestAnimationFrame(() => {
                setIsCreateOpen(true)
            })
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
    // Depends ONLY on selectedFromUrl to prevent async url clearing race condition.
    useEffect(() => {
        requestAnimationFrame(() => {
            if (selectedFromUrl) {
                setBudgetToEdit(selectedFromUrl)
                setIsEditorOpen(true)
            } else {
                setBudgetToEdit(null)
                setIsEditorOpen(false)
            }
        })
    }, [selectedFromUrl])

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

    const actionsCtx: BudgetActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
        onViewExecution: (id) => router.push(`/finances/budgets/${id}`),
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
        budgetActions.column(actionsCtx),
    ]

    return (

        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={budgets}
                    variant="embedded"
                    isLoading={isLoading}
                    entityLabel="accounting.budget"
                    createAction={createAction}
                />
            </div>

            {/* Create Modal */}
            <BaseModal
                open={isCreateOpen}
                onOpenChange={handleCreateOpenChange}
                size="md"
                icon={Wallet}
                title="Crear Nuevo Presupuesto"
                description="Planificación Financiera • Control de Gestión"
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => handleCreateOpenChange(false)} />
                                <Button onClick={handleCreate} className="px-6 font-bold ">
                                    Crear Presupuesto Anual
                                </Button>
                            </>
                        }
                    />
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
                            defaultValue={(serverDate ?? new Date()).getFullYear()}
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
