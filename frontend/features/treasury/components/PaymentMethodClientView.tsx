"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import React, { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { paymentMethodActions, type PaymentMethodActionsCtx } from './paymentMethodActions'
import { paymentMethodEntity, paymentMethodViews } from "../entity-view/paymentMethod.entity"
import { PaymentMethodModal } from "./PaymentMethodModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { paymentMethodUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { usePaymentMethods } from "@/features/treasury/hooks/useMasterData"
import type { PaymentMethod } from "@/features/treasury/types"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"

// --- Payment Method Management ---

interface PaymentMethodClientViewProps {
    externalOpen?: boolean
    onOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PaymentMethodClientView({ externalOpen, onOpenChange, createAction }: PaymentMethodClientViewProps) {
    const { methods, isLoading, isError, refetch, archiveMethod } = usePaymentMethods()
    const search = useUnifiedSearch(paymentMethodUnifiedSearchDef)
    const [dialogOpen, setDialogOpen] = useState(false)
    const { openEntity } = useGlobalModals()
    const [usageFilter, setUsageFilter] = useState<string[]>([])

    const archiveConfirm = useConfirmAction<PaymentMethod>(async (method) => {
        try {
            await archiveMethod({ id: method.id, is_active: !method.is_active })
        } catch {
            // Error handled by hook
        }
    })

    // ADR-0152: cada método abre su ficha en una pestaña propia; esta pestaña de página solo crea.
    const openEdit = (method: PaymentMethod) => openEntity("treasury.paymentmethod", method.id, method)

    const closeDialog = () => {
        setDialogOpen(false)
        onOpenChange?.(false)
    }

    const paymentMethodActionsCtx: PaymentMethodActionsCtx = {
        onEdit: openEdit,
        onArchive: (method) => archiveConfirm.requestConfirm(method),
    }

    const isFiltered = search.isFiltered || usageFilter.length > 0
    const filteredMethods = React.useMemo(() => {
        let result = methods
        if (search.filters.method_type) result = result.filter(m => m.method_type === search.filters.method_type)
        if (search.filters.is_active) result = result.filter(m => String(m.is_active) === search.filters.is_active)
        if (usageFilter.includes('sales')) result = result.filter(m => m.allow_for_sales)
        if (usageFilter.includes('purchases')) result = result.filter(m => m.allow_for_purchases)
        return search.filterFn(result)
    }, [methods, search.filters.method_type, search.filters.is_active, usageFilter, search.filterFn, search])
    const { view, onViewChange } = useCollectionViewMode("treasury.paymentmethod")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        paymentMethodEntity,
        { rows: filteredMethods, isLoading, error: isError && methods.length === 0, refetch, isFiltered },
        { defaultSort: paymentMethodViews.table.defaultSort },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                actions={paymentMethodActions.forCollection(paymentMethodActionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={paymentMethodUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar método de pago..."
                        toolbarActions={
                            <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                'h-control-xs px-2 text-3xs uppercase font-medium tracking-widest gap-1 rounded-sm shrink-0',
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
                        }
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={paymentMethodViews.table}
                    card={paymentMethodViews.card}
                    emptyAction={createAction}
                    onResetFilters={() => { search.clearAll(); setUsageFilter([]) }}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.paymentmethod" id={null} open={dialogOpen || !!externalOpen} onClose={closeDialog}>
                {(open) => (
                    <PaymentMethodModal
                        open={open}
                        onOpenChange={(open: boolean) => { if (!open) closeDialog() }}
                        method={null}
                        onSuccess={() => {
                            closeDialog()
                            refetch()
                        }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Método de Pago" : "Restaurar Método de Pago"}
                description={archiveConfirm.payload?.is_active
                    ? "¿Está seguro de archivar este método de pago? Dejará de estar disponible para nuevas operaciones. Puede restaurarlo más adelante."
                    : "¿Está seguro de restaurar este método de pago?"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
