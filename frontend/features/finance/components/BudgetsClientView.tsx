"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BaseModal, CancelButton, FormFooter, LabeledInput } from '@/components/shared'
import { toast } from "sonner"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { BudgetEditor } from "@/features/finance/components/BudgetEditor"

import { budgetActions, type BudgetActionsCtx } from "@/features/finance/budgetActions"
import { budgetEntity, budgetViews } from "@/features/finance/entity-view/budget.entity"

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

    const { budgets, isLoading, isError, refetch, createBudget } = useBudgets()
    const { serverDate } = useServerDate()
    const { view, onViewChange } = useCollectionViewMode("accounting.budget")

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

    const collection = useEntityCollection(
        budgetEntity,
        { rows: budgets, isLoading, error: isError, refetch },
        { pagination: { mode: "client", pageSize: 20 } },
    )

    return (

        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(budget) => actionsCtx.onViewExecution(budget.id)}
                actions={budgetActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={budgetViews.table}
                    card={budgetViews.card}
                    emptyTitle="Aún no hay presupuestos"
                    emptyAction={createAction}
                />
            </Collection.Root>

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
                                <Button onClick={handleCreate} className="px-6 font-medium">
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
                        <p className="text-3xs text-muted-foreground mt-1">Los presupuestos se restringen obligatoriamente a un año completo (01 Ene - 31 Dic).</p>
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
