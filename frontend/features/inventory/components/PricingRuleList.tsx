"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { PricingRuleForm } from "@/features/sales/components/PricingRuleForm"
import { Pencil, Trash2, Plus } from "lucide-react"

import { toast } from "sonner"
import { StatusBadge } from "@/components/shared/StatusBadge"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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

interface PricingRuleListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { usePricingRules } from "@/features/inventory/hooks/usePricingRules"

export function PricingRuleList({ externalOpen, onExternalOpenChange, createAction }: PricingRuleListProps) {
    const { rules, refetch } = usePricingRules()
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
            await api.delete(`/inventory/pricing-rules/${id}/`)
            toast.success("Regla eliminada correctamente.")
            refetch()
        } catch (error) {
            console.error("Error deleting rule:", error)
            showApiError(error, "Error al eliminar la regla.")
        }
    })

    const columns = useMemo<ColumnDef<PricingRule>[]>(() => [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text className="font-medium text-center w-full">{row.getValue("name")}</DataCell.Text>,
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
                                <DataCell.Text className="font-medium text-xs leading-tight text-center">{rule.product_name}</DataCell.Text>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {rule.product_internal_code && (
                                        <DataCell.Code className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                            {rule.product_internal_code}
                                        </DataCell.Code>
                                    )}
                                    {rule.product_code && rule.product_code !== rule.product_internal_code && (
                                        <DataCell.Code className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase bg-secondary/50">
                                            {rule.product_code}
                                        </DataCell.Code>
                                    )}
                                </div>
                            </>
                        ) : rule.category_name ? (
                            <DataCell.Badge variant="outline" className="w-fit">Categoría: {rule.category_name}</DataCell.Badge>
                        ) : (
                            <DataCell.Badge variant="secondary" className="w-fit">Todos</DataCell.Badge>
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
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                            {row.original.uom_name}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">Base</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "rule_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full text-center">{row.getValue("rule_type_display")}</div>,
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
        createActionsColumn<PricingRule>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setEditingRule(item); setIsFormOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [])


    return (
        <div className="space-y-4">
            <PricingRuleForm
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

            <div className="">
                <DataTable
                    columns={columns}
                    data={rules}
                    cardMode
                    globalFilterFields={["name"]}
                    searchPlaceholder="Buscar por nombre o producto..."
                    facetedFilters={[
                        {
                            column: "active",
                            title: "Estado",
                            options: [
                                { label: "Activo", value: "true" },
                                { label: "Inactivo", value: "false" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    createAction={createAction}
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
