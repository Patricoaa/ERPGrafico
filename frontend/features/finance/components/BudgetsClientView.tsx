"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"

import { Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BaseModal, CancelButton, FormFooter, LabeledInput } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"

import { budgetActions, type BudgetActionsCtx } from "@/features/finance/budgetActions"
import { budgetEntity, budgetViews } from "@/features/finance/entity-view/budget.entity"


interface BudgetsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useBudgets } from "@/features/finance/hooks/useBudgets"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useServerDate } from '@/hooks/useServerDate'

export function BudgetsClientView({ externalOpen, onExternalOpenChange, createAction }: BudgetsClientViewProps) {
    const router = useRouter()

    const { budgets, isLoading, isError, refetch, createBudget } = useBudgets()
    const { serverDate } = useServerDate()
    const { view, onViewChange } = useCollectionViewMode("accounting.budget")

    // Crear (`?modal=new` / botón externo) es la pestaña de página; editar abre la pestaña del presupuesto.
    const createPanel = useCreatePanelRoute({ actions: [], external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada presupuesto abre su editor en una pestaña propia; `?selected` solo es enlace profundo.
    useDeepLinkEntity("accounting.budget")

    const [newBudget, setNewBudget] = useState({
        name: "",
        start_date: `${(serverDate ?? new Date()).getFullYear()}-01-01`,
        end_date: `${(serverDate ?? new Date()).getFullYear()}-12-31`,
        description: ""
    })

    const handleCreate = async () => {
        try {
            await createBudget(newBudget)
            createPanel.close()
            setNewBudget({ name: "", start_date: "", end_date: "", description: "" })
        } catch {
            // Error handled by hook toast
        }
    }

    const actionsCtx: BudgetActionsCtx = {
        onEdit: (id) => openEntity("accounting.budget", id),
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

            <EntityPanelTab label="accounting.budget" {...createPanel.tab}>
                {(open) => (
                    <BaseModal
                        open={open}
                        onOpenChange={(open) => { if (!open) createPanel.close() }}
                        size="md"
                        icon={Wallet}
                        title="Crear Nuevo Presupuesto"
                        description="Planificación Financiera • Control de Gestión"
                        footer={
                            <FormFooter
                                actions={
                                    <>
                                        <CancelButton onClick={() => createPanel.close()} />
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
                )}
            </EntityPanelTab>

        </div>
    )
}
