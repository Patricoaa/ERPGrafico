"use client"

import { EntityPanelTab } from "@/components/providers"
import { showApiError } from "@/lib/errors"

import React from "react"

import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { PricingRuleDrawer } from "@/features/sales"
import { pricingRuleActions, type PricingRuleActionsCtx } from "@/features/inventory/pricingRuleActions"
import { usePricingRules, type PricingRule } from "@/features/inventory/hooks/usePricingRules"
import { pricingRuleUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { pricingRuleEntity, pricingRuleViews } from "../entity-view/pricingRule.entity"

interface PricingRuleClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PricingRuleClientView({ externalOpen, onExternalOpenChange, createAction }: PricingRuleClientViewProps) {
    const search = useUnifiedSearch(pricingRuleUnifiedSearchDef)
    const { rules, isLoading, isError, refetch, deletePricingRule } = usePricingRules(search.filters)
    const { view, onViewChange } = useCollectionViewMode("inventory.pricingrule")
    const collection = useEntityCollection(pricingRuleEntity, { rows: rules, isLoading, error: isError, refetch, isFiltered: search.isFiltered })

    const panel = useEntityPanelRoute<PricingRule>({ endpoint: '/inventory/pricing-rules', external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const selectedFromUrl = panel.entity
    const { openSelected } = useEntityRouteActions()

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            // deletePricingRule invalida PRICING_RULES + PRODUCTS_KEYS;
            // refetch local opcional (la invalidación dispara re-fetch del listado).
            await deletePricingRule(id)
            toast.success("Regla eliminada correctamente.")
        } catch (error) {
            console.error("Error deleting rule:", error)
            showApiError(error, "Error al eliminar la regla.")
        }
   })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const actionsCtx: PricingRuleActionsCtx = {
        onEdit: (item) => openSelected(item.id),
        onDelete: (id) => handleDelete(id),
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <EntityPanelTab label="inventory.pricingrule" {...panel.tab}>
                {(open) => (
                    <PricingRuleDrawer
                        initialData={panel.isCreate ? undefined : (selectedFromUrl ?? undefined)}
                        onSuccess={() => { panel.close(); refetch() }}
                        open={open}
                        onOpenChange={(open: boolean) => {
                            if (!open) panel.close()
                        }}
                    />
                )}
            </EntityPanelTab>

            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(rule) => openSelected(rule.id)}
                actions={pricingRuleActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={pricingRuleUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar reglas de precio..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={pricingRuleViews.table}
                    card={pricingRuleViews.card}
                    emptyTitle="Aún no hay reglas de precio"
                    emptyDescription="Crea reglas para automatizar descuentos y precios por producto o categoría."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Regla de Precios"
                description="¿Está seguro de que desea eliminar esta regla?"
                variant="destructive"
            />
        </div>
    )
}
