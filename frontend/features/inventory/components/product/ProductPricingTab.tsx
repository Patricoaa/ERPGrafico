import { showApiError } from "@/lib/errors"
import { Chip, DataCell, StatusBadge } from "@/components/shared"
import { FormLineItemsTable } from "@/components/shared"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { Percent, Pencil, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { Product, PricingRule } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"

function getRuleStatus(rule: PricingRule): 'RULE_ACTIVE' | 'RULE_EXPIRED' | 'RULE_INACTIVE' {
    if (!rule.active) return 'RULE_INACTIVE'
    if (rule.end_date && new Date(rule.end_date) < new Date()) return 'RULE_EXPIRED'
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
    { header: "Nivel",                  width: "w-[10%]",  align: "left"   as const },
    { header: "Descripción / Vigencia", width: "w-[35%]",  align: "left"   as const },
    { header: "Cant. Mín.",             width: "w-[15%]",  align: "center" as const },
    { header: "Precio / Dcto.",         width: "w-[20%]",  align: "right"  as const },
    { header: "Estado",                 width: "w-[12%]",  align: "center" as const },
    { header: "",                       width: "w-[8%]" },
]

export function ProductPricingTab({ initialData, pricingRules, fetchPricingRules, onOpenRuleDialog, isDynamicPricing, isVariant }: ProductPricingTabProps) {
    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/pricing-rules/${id}/`)
            toast.success("Regla eliminada")
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
                <div className="flex items-start gap-3 p-4 rounded-lg bg-info/5 border border-info/20 text-sm">
                    <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
                    <p className="text-info/80 font-medium text-xs leading-relaxed">
                        Las reglas de precios se gestionan en el <strong>producto plantilla</strong>, no en variantes individuales.
                        El precio efectivo de esta variante depende de su modo de precio (Hereda / Propio / Sobrecargo).
                    </p>
                </div>
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
                                <TableCell colSpan={6}>
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
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{rule.name}</span>
                                                {(rule.start_date || rule.end_date) && (
                                                    <span className="text-[10px] text-muted-foreground font-medium flex gap-2">
                                                        <span>📅 {rule.start_date || '∞'}</span>
                                                        <span>➜</span>
                                                        <span>{rule.end_date || '∞'}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-3 text-center text-sm font-semibold tabular-nums">
                                            {Number(rule.min_quantity)} uds.
                                        </TableCell>
                                        <TableCell className="p-3 text-right font-black text-primary">
                                            {rule.rule_type === 'FIXED'
                                                ? formatCurrency(rule.fixed_price)
                                                : `-${Number(rule.discount_percentage)}%`}
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
