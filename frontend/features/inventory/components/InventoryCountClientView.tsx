"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useState, useCallback } from "react"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, LabeledSelect, LabeledInput } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { inventoryCountEntity, inventoryCountViews } from "../entity-view/inventoryCount.entity"
import { InventoryCountDetailDrawer } from "./InventoryCountDetailDrawer"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useInventoryCounts, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { useWarehouses } from "../hooks/useWarehouses"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { inventoryCountUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SubmitButton, BaseModal } from "@/components/shared"

interface NewCountFormValues {
    warehouse: number
    notes?: string
}

const newCountSchema = z.object({
    warehouse: z.number().min(1, "Selecciona un almacén"),
    notes: z.string().optional(),
})
type NewCountFormData = z.infer<typeof newCountSchema>

export function InventoryCountClientView() {
    const [showNewDialog, setShowNewDialog] = useState(false)
    const search = useUnifiedSearch(inventoryCountUnifiedSearchDef)

    const [pageState, setPageState] = useServerPage([search.filters], { pageIndex: 0, pageSize: 50 })
    const { view, onViewChange } = useCollectionViewMode("inventory.inventorycount")
    const { counts, totalCount, isLoading: isLoadingCounts, isRefetching: isRefetchingCounts, isError: isCountsError, refetch: refetchCounts } = useInventoryCounts({
        ...search.filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const { openSelected } = useEntityRouteActions()
    const panel = useEntityPanelRoute({ create: false })
    const selectedId = panel.selectedId
    // Latched (not reset to null on close) so the drawer's internal edit state only remounts
    // when a *different* count opens, not while the current one is closing (keeps its exit animation).
    const [drawerKey, setDrawerKey] = useState("none")
    if (selectedId && String(selectedId) !== drawerKey) {
        setDrawerKey(String(selectedId))
    }
    const { createCount, isCreating } = useInventoryCountMutations()
    const { warehouses } = useWarehouses()

    const handleCreateCount = useCallback(async (values: NewCountFormValues) => {
        try {
            const result = await createCount({ warehouse: values.warehouse, notes: values.notes })
            setShowNewDialog(false)
            openSelected(result.id)
            toast.success("Sesión de conteo creada")
        } catch (error) {
            showApiError(error, "Error al crear la sesión de conteo")
        }
    }, [createCount, openSelected])

    const countsCollection = useEntityCollection(
        inventoryCountEntity,
        { rows: counts, rowCount: totalCount, isLoading: isLoadingCounts, isRefetching: isRefetchingCounts, error: isCountsError, refetch: refetchCounts, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )

    const createAction = (
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Conteo
        </Button>
    )

    // Preserve the onPointerDownOutside handler to prevent modal closing when clicking on select dropdowns
    const onPointerDownOutside = useCallback((e: Event) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-slot="select-content"]') ||
            target.closest('[role="listbox"]') ||
            target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault()
        }
    }, [])

    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <Collection.Root
                collection={countsCollection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(cnt) => openSelected(cnt.id)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={inventoryCountUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar conteos..." />
                </Collection.Toolbar>
                <Collection.View
                    table={inventoryCountViews.table}
                    card={inventoryCountViews.card}
                    emptyTitle="No hay conteos de inventario"
                    emptyDescription="Crea un nuevo conteo para comparar el stock teórico con el stock real."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="inventory.inventorycount" {...panel.tab}>
                {(open) => (
                    <InventoryCountDetailDrawer
                        key={drawerKey}
                        countId={selectedId}
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        onApplied={refetchCounts}
                    />
                )}
            </EntityPanelTab>

            {/* New Count Dialog - migrated to BaseModal */}
            <BaseModal
                open={showNewDialog}
                onOpenChange={setShowNewDialog}
                title="Nuevo Conteo de Inventario"
                description="Selecciona el almacén para cargar el stock teórico y comenzar el conteo."
                size="xs"
                onPointerDownOutside={onPointerDownOutside}
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => setShowNewDialog(false)}>
                            Cancelar
                        </Button>
                        <SubmitButton type="submit" form="new-count-form" loading={isCreating}>
                            Crear Conteo
                        </SubmitButton>
                    </>
                }
            >
                <NewCountForm
                    warehouses={warehouses}
                    onSubmit={handleCreateCount}
                />
            </BaseModal>
        </div>
    )
}

function NewCountForm({
    warehouses,
    onSubmit,
}: {
    warehouses: Array<{ id: number; name: string }>
    onSubmit: (values: NewCountFormValues) => void
}) {
    const form = useForm<NewCountFormData>({
        resolver: zodResolver(newCountSchema),
        defaultValues: { warehouse: 0, notes: "" },
    })

    return (
        <form id="new-count-form" onSubmit={form.handleSubmit((data) => onSubmit({ warehouse: data.warehouse, notes: data.notes || undefined }))} className="space-y-4">
            <LabeledSelect
                label="Almacén"
                value={form.watch("warehouse")?.toString() ?? ""}
                onChange={(v) => form.setValue("warehouse", Number(v), { shouldValidate: true })}
                placeholder="Seleccione el almacén"
                options={warehouses.map(w => ({ value: w.id.toString(), label: w.name }))}
            />
            {form.formState.errors.warehouse && (
                <p className="text-xs text-destructive">{form.formState.errors.warehouse.message}</p>
            )}
            <LabeledInput
                label="Notas (opcional)"
                placeholder="Motivo del conteo"
                {...form.register("notes")}
            />
        </form>
    )
}