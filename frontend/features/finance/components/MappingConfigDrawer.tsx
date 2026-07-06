"use client"

import React, { useEffect, useCallback } from "react"
import { DataTable, ActionDock, Chip, CmykRing, DataCell, Drawer, AutoSaveStatusBadge, SkeletonShell } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { SlidersHorizontal, AlertCircle, Tag, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useAccountMappings, type MappingType } from "@/features/finance/hooks/useAccountMappings"
import {
    IS_CATEGORIES,
    CF_CATEGORIES,
    BS_CATEGORIES,
    type Account
} from "@/features/accounting/types"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

interface MappingConfigDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mappingType: MappingType
    onSaveSuccess?: () => void
}

const mappingSchema = z.record(z.string(), z.string().nullable())
type MappingValues = z.infer<typeof mappingSchema>

export function MappingConfigDrawer({
    open,
    onOpenChange,
    mappingType,
    onSaveSuccess
}: MappingConfigDrawerProps) {
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

    // Pre-register and reset form values when relevant accounts are loaded
    useEffect(() => {
        if (accounts.length > 0) {
            const defaults: MappingValues = {}
            accounts.forEach(a => {
                const val = (a[fieldName as keyof Account] as string | null) || "none"
                defaults[a.id.toString()] = val
                form.register(a.id.toString())
            })
            form.reset(defaults)
        }
    }, [accounts, fieldName, form])

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

    // Central onSave handler for the autosave hook
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

    // Flush any pending changes immediately when drawer is closing
    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            void flush()
        }
        onOpenChange(newOpen)
    }, [flush, onOpenChange])

    const handleBulkUpdate = (items: Account[], value: string, clear: () => void) => {
        items.forEach(item => {
            form.setValue(item.id.toString(), value === "none" ? "none" : value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
            })
        })
        clear()
    }

    const columns: ColumnDef<Account>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="translate-y-[2px] border-muted-foreground/30"
                    variant="circle"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className="translate-y-[2px] border-muted-foreground/30"
                    variant="circle"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "code",
            header: "Código",
            cell: ({ row }) => (
                <DataCell.Code className="justify-start opacity-70">
                    {row.getValue("code")}
                </DataCell.Code>
            )
        },
        {
            accessorKey: "name",
            header: "Cuenta",
            cell: ({ row }) => (
                <DataCell.Text className="justify-start tracking-tight uppercase max-w-[200px] sm:max-w-[300px] truncate">
                    {row.getValue("name")}
                </DataCell.Text>
            )
        },
        {
            accessorKey: "account_type_display",
            header: "Tipo",
            cell: ({ row }) => (
                <Chip size="xs" intent="neutral" className="h-5 rounded-sm bg-muted/30">
                    {row.getValue("account_type_display")}
                </Chip>
            )
        },
        {
            id: "category",
            header: "Categoría Asignada",
            cell: ({ row }) => {
                const account = row.original
                return (
                    <Controller
                        control={form.control}
                        name={account.id.toString()}
                        render={({ field }) => {
                            const fieldValue = field.value as string | null | undefined
                            const currentValue = fieldValue ?? "none"
                            const originalValue = account[fieldName as keyof Account] as string | null
                            const isModified = currentValue !== (originalValue || "none")

                            return (
                                <div className="flex items-center gap-2">
                                    {(!fieldValue || fieldValue === "none") && (
                                        <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                                    )}
                                    <Select
                                        value={currentValue}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger className={cn(
                                            "h-8 text-[11px] font-medium w-[200px]",
                                            isModified && "ring-1 ring-primary/50 border-primary/50 bg-primary/5",
                                            (!fieldValue || fieldValue === "none") && !isModified && "text-warning border-warning/30 bg-warning/5"
                                        )}>
                                            <SelectValue placeholder="Sin mapeo" />
                                        </SelectTrigger>
                                        <SelectContent className="w-[var(--radix-select-trigger-width)]">
                                            <SelectItem value="none" className="text-muted-foreground italic">Sin mapeo</SelectItem>
                                            {getCategories().map(cat => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        }}
                    />
                )
            }
        }
    ]

    return (
        <Drawer
            open={open}
            onOpenChange={handleOpenChange}
            side="bottom"
            boundary="embedded"
            resizable={false}
            defaultSize="100%"
            title={getTitle()}
            subtitle={getSubtitle()}
            icon={SlidersHorizontal}
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
            <div className="flex-1 flex flex-col min-h-0">
                <DataTable
                    columns={columns}
                    data={accounts}
                    isLoading={isLoading}
                    variant="embedded"
                    bulkDock={(items, clear) => (
                        <ActionDock isVisible>
                            <div className="flex items-center gap-2">
                                <CmykRing size="sm" className="animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">
                                    {`${items.length} ${items.length === 1 ? "seleccionado" : "seleccionados"}`}
                                </span>
                            </div>
                            <ActionDock.Actions>
                                <Select onValueChange={(value) => handleBulkUpdate(items, value, clear)}>
                                    <SelectTrigger className="h-9 rounded-sm border-border/40 bg-muted/30 text-xs font-bold uppercase tracking-widest w-[200px] hover:bg-muted/50 transition-colors">
                                        <Tag className="mr-2 h-3.5 w-3.5" />
                                        <SelectValue placeholder="Asignar Categoría" />
                                    </SelectTrigger>
                                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                                        <SelectItem value="none" className="text-muted-foreground italic">Quitar mapeo</SelectItem>
                                        {getCategories().map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </ActionDock.Actions>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clear}
                                className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted"
                            >
                                <X className="h-3 w-3 mr-1.5" />
                                Limpiar
                            </Button>
                        </ActionDock>
                    )}
                />
            </div>
            </SkeletonShell>
        </Drawer>
    )
}

