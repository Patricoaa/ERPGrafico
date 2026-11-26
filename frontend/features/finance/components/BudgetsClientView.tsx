"use client"

import React, { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BaseModal, CancelButton, FormFooter, LabeledInput } from '@/components/shared'
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { EntityPanelTab, useGlobalModals } from "@/components/providers"

import { budgetActions, type BudgetActionsCtx } from "@/features/finance/budgetActions"
import { budgetEntity, budgetViews } from "@/features/finance/entity-view/budget.entity"
import { useBudgets, type Budget } from "@/features/finance/hooks/useBudgets"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useServerDate } from '@/hooks/useServerDate'

import { BudgetExecutionPanel } from "./BudgetExecutionPanel"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

interface BudgetsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function BudgetsClientView({ externalOpen, onExternalOpenChange, createAction }: BudgetsClientViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // ADR-0158: la barra canónica es dueña de búsqueda, filtros, orden y vistas; el viewset resuelve todo.
    const query = useCollectionQuery(budgetEntity)
    const { search } = query
    const [pageState, setPageState] = useServerPage([query.params], DEFAULT_PAGE)
    const listParams = React.useMemo(
        () => ({
            ...query.params,
            page: String(pageState.pageIndex + 1),
            page_size: String(pageState.pageSize),
        }),
        [query.params, pageState.pageIndex, pageState.pageSize],
    )
    const { page, budgets, isLoading, isError, refetch, createBudget } = useBudgets(listParams)
    const { serverDate } = useServerDate()
    const { view, onViewChange } = useCollectionViewMode("accounting.budget")

    // Crear (`?modal=new` / botón externo) es la pestaña de página; editar abre la pestaña del presupuesto.
    const createPanel = useCreatePanelRoute({ actions: [], external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    // ADR-0152: `?selected` sin `action` abre el editor; con `action=execution` solo abre el panel de ejecución.
    const executionPanel = useCreatePanelRoute<Budget>({
        endpoint: "/accounting/budgets",
        actions: ["execution"],
        create: false,
    })
    const { openEntity } = useGlobalModals()
    useDeepLinkEntity("accounting.budget", { actions: [null] })

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

    const openExecution = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        params.set("action", "execution")
        // Simetría con `close()` (ADR-0152): «Atrás» no debe reabrir un panel ya cerrado.
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const actionsCtx: BudgetActionsCtx = {
        onEdit: (id) => openEntity("accounting.budget", id),
        onViewExecution: openExecution,
    }

    const collection = useEntityCollection(
        budgetEntity,
        {
            rows: budgets,
            rowCount: page?.count,
            isLoading,
            error: isError,
            refetch,
            isFiltered: search.isFiltered,
        },
        {
            pagination: { mode: "server", state: pageState, onChange: setPageState },
            sorting: query.sorting,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={(budget) => openEntity("accounting.budget", budget.id)}
                actions={budgetActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={budgetViews.table}
                    card={budgetViews.card}
                    emptyTitle="Aún no hay presupuestos"
                    emptyAction={createAction}
                    onResetFilters={query.search.clearAll}
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

            <EntityPanelTab label="accounting.budget" {...executionPanel.tab} variant="execution" display={`Ejecución: ${executionPanel.entity?.name ?? "…"}`}>
                {(open) => (
                    <BudgetExecutionPanel
                        budget={executionPanel.entity}
                        open={open}
                        onOpenChange={(next) => { if (!next) executionPanel.close() }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}
