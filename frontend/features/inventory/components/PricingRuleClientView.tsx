"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ActionConfirmModal, DataTableColumnHeader, DataTableView, EntityCard, StatusBadge } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
// useDeletePricingRule consumido vía usePricingRules.
import { PricingRuleDrawer } from "@/features/sales/components/PricingRuleDrawer"
import { pricingRuleActions, type PricingRuleActionsCtx } from "@/features/inventory/pricingRuleActions"
import { toast } from "sonner"

import { useConfirmAction } from "@/hooks/useConfirmAction"

interface PricingRule {
    id: number
    name: string
    product?: number
    product_name?: string
    category?: number
    category_name?: string
    uom?: number
    uom_name?: string
    product_code?: string
    product_internal_code?: string | null
    operator: "BT" | "GT" | "LT" | "EQ" | "GE" | "LE"
    operator_display: string
    min_quantity: string
    max_quantity?: string
    rule_type: "FIXED" | "DISCOUNT_PERCENTAGE"
    rule_type_display: string
    fixed_price?: string
    discount_percentage?: string
    start_date?: string
    end_date?: string
    priority: number
    active: boolean
}

interface PricingRuleClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { usePricingRules } from "@/features/inventory/hooks/usePricingRules"
import { Chip, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { pricingRuleSearchDef } from "@/features/inventory/searchDef"
import { pricingRuleSegDef } from "@/features/inventory/segmentationDef"

export function PricingRuleClientView({ externalOpen, onExternalOpenChange, createAction }: PricingRuleClientViewProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(pricingRuleSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(pricingRuleSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = useMemo(() => ({ ...textFilters, ...segFilters }), [textFilters, segFilters])
    const { rules, isLoading, refetch, deletePricingRule } = usePricingRules(allFilters)
    const [editingRule, setEditingRule] = useState<PricingRule | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingRule(null)
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

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
        onEdit: (item) => { setEditingRule(item); setIsFormOpen(true) },
        onDelete: (id) => handleDelete(id),
    }

    const columns = useMemo<ColumnDef<PricingRule>[]>(() => [
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("id")}</DataCell.Code>,
            size: 80,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("name")}</DataCell.Text>,
        },
        {
            id: "applies_to",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aplica a" className="justify-center" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div className="flex flex-col items-center gap-1 py-1 w-full">
                        {rule.product_name ? (
                            <>
                                <DataCell.Text>{rule.product_name}</DataCell.Text>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {rule.product_internal_code && (
                                        <DataCell.Code>
                                            {rule.product_internal_code}
                                        </DataCell.Code>
                                    )}
                                    {rule.product_code && rule.product_code !== rule.product_internal_code && (
                                        <DataCell.Code>
                                            {rule.product_code}
                                        </DataCell.Code>
                                    )}
                                </div>
                            </>
                        ) : rule.category_name ? (
                            <Chip size="xs" className="w-fit">Categoría: {rule.category_name}</Chip>
                        ) : (
                            <Chip size="xs" className="w-fit">Todos</Chip>
                        )}
                    </div>
                )
            },
        },
        {
            id: "condition",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Condición (Cantidad)" className="justify-center" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div className="text-center font-mono w-full">
                        <span className="text-xs text-muted-foreground mr-1">{rule.operator_display}</span>
                        <span className="font-bold">{Number(rule.min_quantity)}</span>
                        {rule.operator === "BT" && rule.max_quantity && (
                            <> y <span className="font-bold">{Number(rule.max_quantity)}</span></>
                        )}
                    </div>
                )
            },
        },
        {
            id: "uom",
            header: ({ column }) => <DataTableColumnHeader column={column} title="UdM" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {row.original.uom_name ? (
                        <Chip size="xs">{row.original.uom_name}</Chip>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">Base</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "rule_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("rule_type_display")}</DataCell.Text>,
        },
        {
            id: "value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valor" className="justify-center" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div className="flex justify-center w-full">
                        <span className="font-bold">
                            {rule.rule_type === "FIXED"
                                ? <DataCell.Currency value={Number(rule.fixed_price)} />
                                : `${Number(rule.discount_percentage)}%`}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "validity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Vigencia" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <span className="text-xs whitespace-nowrap">{row.original.start_date || '...'} a {row.original.end_date || '...'}</span>
                </div>
            ),
        },
        {
            accessorKey: "priority",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full text-center">{row.getValue("priority")}</div>,
        },
        {
            accessorKey: "active",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge
                        status={row.getValue("active") ? "SUCCESS" : "ERROR"}
                        label={row.getValue("active") ? "Activo" : "Inactivo"}
                    />
                </div>
            ),
        },
        pricingRuleActions.column(actionsCtx),
    ], [actionsCtx])

    return (
        <div className="h-full flex flex-col">
            <PricingRuleDrawer
                initialData={editingRule || undefined}
                onSuccess={refetch}
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open: boolean) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
                    }
                }}
            />

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={rules}
                    isLoading={isLoading}
                    entityLabel="inventory.pricingrule"
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={pricingRuleSearchDef} placeholder="Buscar reglas de precio..." className="w-full" />}
                    segmentation={<SegmentationBar def={pricingRuleSegDef} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay reglas de precio",
                        description: "Crea reglas para automatizar descuentos y precios por producto o categoría.",
                    }}
                    renderCard={(rule: PricingRule) => (
                        <EntityCard onClick={() => { setEditingRule(rule); setIsFormOpen(true) }} actions={pricingRuleActions.render(rule, actionsCtx)}>
                            <EntityCard.Header
                                title={rule.name}
                                subtitle={rule.product_name ?? rule.category_name ?? 'Sin producto/categoría'}
                                trailing={<StatusBadge status={rule.active ? 'active' : 'inactive'} size="sm" />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Tipo" value={rule.rule_type_display} />
                                <EntityCard.Field
                                    label="Precio"
                                    value={
                                        rule.fixed_price
                                            ? <DataCell.Currency value={rule.fixed_price} />
                                            : rule.discount_percentage
                                                ? <DataCell.Number value={rule.discount_percentage} suffix="%" />
                                                : '—'
                                    }
                                />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

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
