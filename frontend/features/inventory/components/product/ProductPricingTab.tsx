"use client"

import { showApiError } from "@/lib/errors"
import { ActionConfirmModal, Banner, Chip, DataCell, EmptyState, StatusBadge } from '@/components/shared'
import { FormLineItemsTable } from "@/components/shared"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"

import { Percent, Pencil } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { type Product, type PricingRule } from "@/types/entities"
import { type ProductInitialData } from "@/types/forms"
import { usePricingRules } from "../../hooks/usePricingRules"
import { parseDateOnly, formatPlainDate } from "@/lib/utils"

function getRuleStatus(rule: PricingRule): 'RULE_ACTIVE' | 'RULE_EXPIRED' | 'RULE_INACTIVE' {
    if (!rule.active) return 'RULE_INACTIVE'
    if (rule.end_date && parseDateOnly(rule.end_date) < new Date()) return 'RULE_EXPIRED'
    return 'RULE_ACTIVE'
}

interface ProductPricingTabProps {
    initialData?: ProductInitialData | Partial<Product>
    pricingRules: PricingRule[]
    fetchPricingRules: () => void
    onOpenRuleDialog: (rule?: PricingRule) => void
    isDynamicPricing?: boolean
    isVariant?: boolean
}

const COLUMNS = [
    { header: "Nivel",               align: "left"   as const },
    { header: "Descripción",         align: "left"   as const },
    { header: "Unidad",              align: "left"   as const },
    { header: "Condición",           align: "center" as const },
    { header: "Cantidad",            align: "center" as const },
    { header: "Tipo de ajuste",      align: "left"   as const },
    { header: "Precio / Dcto.",      align: "right"  as const },
    { header: "Caducidad",           align: "center" as const },
    { header: "Estado",              align: "center" as const },
    { header: "" },
]

const OPERATOR_SYMBOL: Record<string, string> = { GT: ">", LT: "<", EQ: "=", GE: "≥", LE: "≤", BT: "Entre" }
const ADJUSTMENT_LABEL: Record<string, string> = {
    FIXED: "Precio fijo (unitario)",
    PACKAGE_FIXED: "Precio paquete (total)",
    DISCOUNT_PERCENTAGE: "Descuento %",
}

function formatQuantity(rule: PricingRule): string {
    const min = Number(rule.min_quantity)
    return rule.operator === 'BT' && rule.max_quantity != null
        ? `${min} – ${Number(rule.max_quantity)}`
        : String(min)
}

function formatAdjustment(rule: PricingRule): string {
    return rule.rule_type === 'DISCOUNT_PERCENTAGE'
        ? `-${Number(rule.discount_percentage)}%`
        : formatCurrency(rule.fixed_price)
}

export function ProductPricingTab({ initialData, pricingRules, fetchPricingRules, onOpenRuleDialog, isDynamicPricing, isVariant }: ProductPricingTabProps) {
    const { deletePricingRule } = usePricingRules()
    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deletePricingRule(id)
            toast.success("Regla eliminada")
            // El hook invalida PRICING_RULES_QUERY_KEY automáticamente. Llamamos
            // fetchPricingRules para que el padre (ProductForm) refresque su
            // estado local imperativo. Cuando ProductForm migre a usePricingRules
            // este callback puede removerse.
            fetchPricingRules()
        } catch (error) {
            showApiError(error, "Error al eliminar la regla")
        }
    })

    return (
        <div className="space-y-4 flex flex-col">
            {/* Not-yet-saved state — product must exist before rules */}
            {!initialData && (
                <div className="flex-1 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center px-2 py-8">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Pencil className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h4 className="font-medium text-muted-foreground">Debe crear el producto primero</h4>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">
                        Las reglas de precios específicas requieren que el producto esté registrado en el sistema.
                    </p>
                </div>
            )}

            {/* Variant notice — rules are managed at template level */}
            {initialData && isVariant && (
                <Banner tone="info">
                    Las reglas de precios se gestionan en el <strong>producto plantilla</strong>, no en variantes individuales.
                    El precio efectivo de esta variante depende de su modo de precio (Hereda / Propio / Sobrecargo).
                </Banner>
            )}

            {initialData && !isDynamicPricing && (
                <FormLineItemsTable
                    icon={Percent}
                    title="Reglas de Precio"
                    subtitle={
                        pricingRules.length > 0
                            ? `${pricingRules.length} regla(s) activa(s)`
                            : "Descuentos por volumen y precios especiales"
                    }
                    columns={COLUMNS}
                    onAdd={isVariant ? undefined : () => onOpenRuleDialog()}
                    addButtonText="Nueva Regla"
                >
                    <TableBody>
                        {pricingRules.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length}>
                                    <EmptyState
                                        context="finance"
                                        variant="compact"
                                        title="Sin reglas de precio"
                                        description="No hay reglas de precio personalizadas para este producto."
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            pricingRules.map((rule) => {
                                const isProductRule = rule.product !== null
                                return (
                                    <TableRow key={rule.id} className="group hover:bg-primary/5 transition-colors">
                                        <TableCell className="p-3">
                                            {rule.is_category_rule ? (
                                                <Chip size="sm" intent="warning">Categoría</Chip>
                                            ) : (
                                                <Chip size="xs" intent="primary">Producto</Chip>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-3">
                                            <span className="font-bold text-sm">{rule.name}</span>
                                        </TableCell>
                                        <TableCell className="p-3 text-sm">{rule.uom_name || "—"}</TableCell>
                                        <TableCell className="p-3 text-center text-sm font-semibold">
                                            {OPERATOR_SYMBOL[rule.operator ?? 'GE']}
                                        </TableCell>
                                        <TableCell className="p-3 text-center text-sm font-semibold tabular-nums">
                                            {formatQuantity(rule)}
                                        </TableCell>
                                        <TableCell className="p-3 text-sm">
                                            {ADJUSTMENT_LABEL[rule.rule_type] ?? rule.rule_type}
                                        </TableCell>
                                        <TableCell className="p-3 text-right font-black text-primary">
                                            {formatAdjustment(rule)}
                                        </TableCell>
                                        <TableCell className="p-3 text-center text-xs text-muted-foreground">
                                            {rule.end_date ? `Hasta ${formatPlainDate(rule.end_date)}` : "Sin caducidad"}
                                        </TableCell>
                                        <TableCell className="p-3 text-center">
                                            <StatusBadge status={getRuleStatus(rule)} />
                                        </TableCell>
                                        <TableCell className="p-3 text-right">
                                            {isProductRule && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <DataCell.ActionGroup>
                                                        <DataCell.Action
                                                            action="edit"
                                                            onClick={() => onOpenRuleDialog(rule)}
                                                        />
                                                        <DataCell.Action
                                                            action="delete"
                                                            onClick={() => deleteConfirm.requestConfirm(rule.id)}
                                                        />
                                                    </DataCell.ActionGroup>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </FormLineItemsTable>
            )}

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Regla"
                description="¿Estás seguro de eliminar esta regla?"
                variant="destructive"
            />
        </div>
    )
}
