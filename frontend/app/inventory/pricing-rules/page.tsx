"use client"

import React, { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { PricingRuleForm } from "@/components/forms/PricingRuleForm"
import { Pencil, Trash2 } from "lucide-react"
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

export default function PricingRulesPage() {
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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Reglas de Precio</h2>
                <div className="flex items-center space-x-2">
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
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Aplica a</TableHead>
                            <TableHead className="text-right">Condición (Cantidad)</TableHead>
                            <TableHead>UdM</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Vigencia</TableHead>
                            <TableHead className="text-center">Prioridad</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="w-[100px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-medium">{rule.name}</TableCell>
                                <TableCell>
                                    {rule.product_name ? (
                                        <Badge variant="outline">Producto: {rule.product_name}</Badge>
                                    ) : rule.category_name ? (
                                        <Badge variant="outline">Categoría: {rule.category_name}</Badge>
                                    ) : (
                                        <Badge variant="secondary">Todos</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    <span className="text-xs text-muted-foreground mr-1">{rule.operator_display}</span>
                                    {Number(rule.min_quantity)}
                                    {rule.operator === "BT" && rule.max_quantity && (
                                        <> y {Number(rule.max_quantity)}</>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {rule.uom_name ? (
                                        <Badge variant="outline">{rule.uom_name}</Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">Base</span>
                                    )}
                                </TableCell>
                                <TableCell>{rule.rule_type_display}</TableCell>
                                <TableCell className="text-right font-bold">
                                    {rule.rule_type === "FIXED"
                                        ? `$${Number(rule.fixed_price).toLocaleString()}`
                                        : `${Number(rule.discount_percentage)}%`}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                    {rule.start_date || '...'} a {rule.end_date || '...'}
                                </TableCell>
                                <TableCell className="text-center">{rule.priority}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={rule.active ? "default" : "secondary"}>
                                        {rule.active ? "Activo" : "Inactivo"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditingRule(rule)
                                                setIsFormOpen(true)
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(rule.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center">Cargando reglas...</TableCell>
                            </TableRow>
                        )}
                        {!loading && rules.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center">No hay reglas registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
