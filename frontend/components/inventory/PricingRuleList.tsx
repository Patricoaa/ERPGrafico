"use client"

import React, { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { PricingRuleForm } from "@/components/forms/PricingRuleForm"
import { Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface PricingRule {
    id: number
    name: string
    product: number | null
    product_name: string | null
    category: number | null
    category_name: string | null
    uom: number | null
    uom_name: string | null
    operator: string
    operator_display: string
    min_quantity: string
    max_quantity: string | null
    rule_type: "FIXED" | "DISCOUNT_PERCENTAGE"
    rule_type_display: string
    fixed_price: string | null
    discount_percentage: string | null
    start_date: string | null
    end_date: string | null
    priority: number
    active: boolean
}

export function PricingRuleList() {
    const [rules, setRules] = useState<PricingRule[]>([])
    const [loading, setLoading] = useState(true)
    const [editingRule, setEditingRule] = useState<PricingRule | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const fetchRules = async () => {
        setLoading(true)
        try {
            const response = await api.get('/inventory/pricing-rules/')
            setRules(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch rules", error)
            toast.error("Error al cargar las reglas de precio.")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de que desea eliminar esta regla?")) return
        try {
            await api.delete(`/inventory/pricing-rules/${id}/`)
            toast.success("Regla eliminada correctamente.")
            fetchRules()
        } catch (error) {
            console.error("Error deleting rule:", error)
            toast.error("Error al eliminar la regla.")
        }
    }

    useEffect(() => {
        fetchRules()
    }, [])

    const columns: ColumnDef<PricingRule>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            id: "applies_to",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aplica a" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div>
                        {rule.product_name ? (
                            <Badge variant="outline">Producto: {rule.product_name}</Badge>
                        ) : rule.category_name ? (
                            <Badge variant="outline">Categoría: {rule.category_name}</Badge>
                        ) : (
                            <Badge variant="secondary">Todos</Badge>
                        )}
                    </div>
                )
            },
        },
        {
            id: "condition",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Condición (Cantidad)" className="justify-end" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div className="text-right font-mono">
                        <span className="text-xs text-muted-foreground mr-1">{rule.operator_display}</span>
                        {Number(rule.min_quantity)}
                        {rule.operator === "BT" && rule.max_quantity && (
                            <> y {Number(rule.max_quantity)}</>
                        )}
                    </div>
                )
            },
        },
        {
            id: "uom",
            header: ({ column }) => <DataTableColumnHeader column={column} title="UdM" />,
            cell: ({ row }) => {
                const name = row.original.uom_name
                return name ? <Badge variant="outline">{name}</Badge> : <span className="text-xs text-muted-foreground italic">Base</span>
            },
        },
        {
            accessorKey: "rule_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => <div>{row.getValue("rule_type_display")}</div>,
        },
        {
            id: "value",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Valor" className="justify-end" />,
            cell: ({ row }) => {
                const rule = row.original
                return (
                    <div className="text-right font-bold">
                        {rule.rule_type === "FIXED"
                            ? `$${Number(rule.fixed_price).toLocaleString()}`
                            : `${Number(rule.discount_percentage)}%`}
                    </div>
                )
            },
        },
        {
            id: "validity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Vigencia" />,
            cell: ({ row }) => <div className="text-xs whitespace-nowrap">{row.original.start_date || '...'} a {row.original.end_date || '...'}</div>,
        },
        {
            accessorKey: "priority",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Prioridad" className="justify-center" />,
            cell: ({ row }) => <div className="text-center">{row.getValue("priority")}</div>,
        },
        {
            accessorKey: "active",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant={row.getValue("active") ? "default" : "secondary"}>
                        {row.getValue("active") ? "Activo" : "Inactivo"}
                    </Badge>
                </div>
            ),
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="text-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingRule(row.original); setIsFormOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setIsFormOpen(true)} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Regla
                    </Button>
                </div>
            </div>

            <PricingRuleForm
                onSuccess={fetchRules}
                open={isFormOpen && !editingRule}
                onOpenChange={(open: boolean) => {
                    setIsFormOpen(open)
                    if (!open) setEditingRule(null)
                }}
            />
            {editingRule && (
                <PricingRuleForm
                    initialData={editingRule}
                    open={isFormOpen && !!editingRule}
                    onOpenChange={(open: boolean) => {
                        setIsFormOpen(open)
                        if (!open) setEditingRule(null)
                    }}
                    onSuccess={fetchRules}
                />
            )}

            <div className="">
                <DataTable
                    columns={columns}
                    data={rules}
                    globalFilterFields={["name"]}
                    searchPlaceholder="Buscar por nombre o producto..."
                />
            </div>
        </div>
    )
}
