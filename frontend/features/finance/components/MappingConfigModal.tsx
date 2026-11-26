"use client"

import React, { useCallback, useMemo } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { BaseModal, AutoSaveStatusBadge, SkeletonShell } from '@/components/shared'
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { SlidersHorizontal } from "lucide-react"

import { useAccountMappings, type MappingType } from "@/features/finance/hooks/useAccountMappings"
import {
    IS_CATEGORIES,
    CF_CATEGORIES,
    BS_CATEGORIES,
    type Account
} from "@/features/accounting"
import { accountMappingEntity, accountMappingViews, MappingCategoriesProvider, type AccountMappingRow } from "../entity-view/accountMapping.entity"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

interface MappingConfigModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mappingType: MappingType
    onSaveSuccess?: () => void
}

const mappingSchema = z.record(z.string(), z.string().nullable())
type MappingValues = z.infer<typeof mappingSchema>

export function MappingConfigModal({
    open,
    onOpenChange,
    mappingType,
    onSaveSuccess
}: MappingConfigModalProps) {
    const {
        accounts,
        isLoading,
        fieldName,
        saveAll
    } = useAccountMappings(mappingType)

    const form = useForm<MappingValues>({
        resolver: zodResolver(mappingSchema),
        defaultValues: {}
    })

    useInitializeDrawerForm({
        form,
        open,
        initialData: accounts,
        getEntityId: (accs) => `${mappingType}-${accs.length}`,
        mapData: (accs) => {
            const defaults: MappingValues = {}
            accs.forEach(a => {
                const val = (a[fieldName as keyof Account] as string | null) || "none"
                defaults[a.id.toString()] = val
                form.register(a.id.toString())
            })
            return defaults
        },
        defaultValues: () => ({}),
    })

    // Own URL keys (`map_…`): the modal opens over the reports page.
    const query = useCollectionQuery(accountMappingEntity, { sorting: "client", urlPrefix: "map_" })
    const { search } = query
    const rows = useMemo<AccountMappingRow[]>(
        () => accounts.map((a) => ({ ...a, original: (a[fieldName as keyof Account] as string | null) || "none" })),
        [accounts, fieldName],
    )
    const filteredRows = useMemo(() => search.filterFn(rows), [search, rows])
    const collection = useEntityCollection(
        accountMappingEntity,
        { rows: filteredRows, isLoading, isFiltered: search.isFiltered },
        { pagination: { mode: "none" }, sorting: query.sorting },
    )

    const getCategories = () => {
        switch (mappingType) {
            case 'is': return IS_CATEGORIES
            case 'cf': return CF_CATEGORIES
            case 'bs': return BS_CATEGORIES
        }
    }

    const getTitle = () => {
        switch (mappingType) {
            case 'is': return "Mapeo Estado de Resultados"
            case 'cf': return "Mapeo Flujo de Caja"
            case 'bs': return "Mapeo Balance General"
        }
    }

    const getSubtitle = () => {
        switch (mappingType) {
            case 'is': return "Asigna cuentas de ingresos y gastos a categorías del EERR"
            case 'cf': return "Asigna flujos operativos, de inversión o financiamiento"
            case 'bs': return "Asigna activos, pasivos y patrimonio a categorías del balance"
        }
    }

    const onSave = useCallback(async (values: MappingValues) => {
        const updates: { id: number; field: string; value: string | null }[] = []
        accounts.forEach(a => {
            const val = values[a.id.toString()] as string | null | undefined
            const originalVal = (a[fieldName as keyof Account] as string | null) || "none"
            if (val !== originalVal) {
                updates.push({
                    id: a.id,
                    field: fieldName,
                    value: val === "none" ? null : (val ?? null)
                })
            }
        })

        if (updates.length > 0) {
            await saveAll(updates)
            onSaveSuccess?.()
        }
    }, [accounts, fieldName, saveAll, onSaveSuccess])

    const { status, invalidReason, lastSavedAt, retry, flush } = useAutoSaveForm({
        form,
        onSave,
        enabled: !isLoading && open,
        debounceMs: 500
    })

    useUnsavedChangesGuard(status)

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            void flush()
        }
        onOpenChange(newOpen)
    }, [flush, onOpenChange])

    const handleBulkUpdate = (items: AccountMappingRow[], value: string) => {
        items.forEach(item => {
            form.setValue(item.id.toString(), value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            })
        })
    }

    const categoryOptions = useMemo(() => getCategories().map((c) => ({ value: c.value, label: c.label })), [mappingType]) // eslint-disable-line react-hooks/exhaustive-deps -- getCategories reads mappingType only

    return (
        <BaseModal
            open={open}
            onOpenChange={handleOpenChange}
            size="xl"
            title={getTitle()}
            description={getSubtitle()}
            icon={SlidersHorizontal}
            hideScrollArea
            contentClassName="flex flex-col min-h-0 px-8 pb-8"
            headerActions={
                <div className="flex items-center gap-3">
                    <AutoSaveStatusBadge
                        status={status}
                        invalidReason={invalidReason}
                        lastSavedAt={lastSavedAt}
                        onRetry={retry}
                    />
                </div>
            }
        >
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando mapeo de cuentas">
                <div className="flex-1 flex flex-col min-h-0 max-h-[65vh] overflow-hidden">
                    <FormProvider {...form}>
                        <MappingCategoriesProvider options={categoryOptions}>
                            <Collection.Root collection={collection} query={query} selection="bulk" label="Cuentas a mapear">
                                <Collection.Toolbar />
                                <Collection.View
                                    table={accountMappingViews.table}
                                    emptyTitle="Sin cuentas"
                                    emptyDescription="No hay cuentas para este informe."
                                    onResetFilters={() => void search.clearAll()}
                                />
                                <Collection.BulkBar<AccountMappingRow>
                                    choice={{
                                        label: "Asignar categoría",
                                        options: [{ value: "none", label: "Quitar mapeo" }, ...categoryOptions],
                                        onChoose: handleBulkUpdate,
                                    }}
                                />
                            </Collection.Root>
                        </MappingCategoriesProvider>
                    </FormProvider>
                </div>
            </SkeletonShell>
        </BaseModal>
    )
}
