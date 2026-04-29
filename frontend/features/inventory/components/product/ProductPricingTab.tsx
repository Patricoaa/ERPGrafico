import { showApiError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Info, Plus, Pencil, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { Product, PricingRule } from "@/types/entities"
import { ProductInitialData } from "@/types/forms"

interface ProductPricingTabProps {
    initialData?: ProductInitialData | Partial<Product>
    pricingRules: PricingRule[]
    fetchPricingRules: () => void
    onOpenRuleDialog: (rule?: PricingRule) => void
}

export function ProductPricingTab({ initialData, pricingRules, fetchPricingRules, onOpenRuleDialog }: ProductPricingTabProps) {
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
        <div className="space-y-4 h-full flex flex-col">
            {initialData && (
                <Card variant="dashed" className="flex items-center justify-between p-4 rounded-md border bg-primary/5 border-primary/10 shadow-sm">
                    <div className="flex gap-4 items-center">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="font-semibold text-sm">Políticas de Precios Dinámicas</h3>
                            <p className="text-[10px] text-muted-foreground">Las reglas se aplican automáticamente según la cantidad y vigencia.</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onOpenRuleDialog()}
                        className="rounded-md text-xs font-bold"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Regla
                    </Button>
                </Card>
            )}

            {!initialData && (
                <div className="flex-1 min-h-[600px] border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center px-6">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Pencil className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h4 className="font-medium text-muted-foreground">Debe crear el producto primero</h4>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Las reglas de precios específicas requieren que el producto esté registrado en el sistema.</p>
                </div>
            )}

            {initialData && (
                <div className="border rounded-md overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                                <TableHead>Nivel</TableHead>
                                <TableHead>Descripción / Vigencia</TableHead>
                                <TableHead>Cantidad Mín</TableHead>
                                <TableHead className="text-right">Precio / Descuento</TableHead>
                                <TableHead className="text-center w-[100px]">Estado</TableHead>
                                <TableHead className="text-right w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pricingRules.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <EmptyState context="finance" variant="compact" title="Sin reglas de precio" description="No hay reglas de precio personalizadas para este producto." />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pricingRules.map((rule) => {
                                    const isProductRule = rule.product !== null;
                                    return (
                                        <TableRow key={rule.id} className="group transition-colors">
                                            <TableCell>
                                                {rule.is_category_rule ? (
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                        Categoría
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border bg-primary/5 text-primary border-primary/20">
                                                        Producto
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
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
                                            <TableCell className="text-sm font-semibold tabular-nums">{Number(rule.min_quantity)} unidad(es)</TableCell>
                                            <TableCell className="text-right font-black text-primary">
                                                {rule.rule_type === 'FIXED'
                                                    ? formatCurrency(rule.fixed_price)
                                                    : `-${Number(rule.discount_percentage)}%`}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className={cn(
                                                    "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border transition-colors",
                                                    rule.active
                                                        ? 'bg-success/10 text-success border-success/20'
                                                        : 'bg-muted/50 text-muted-foreground border-transparent'
                                                )}>
                                                    {rule.active ? "Activa" : "Inactiva"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right flex gap-1 justify-end">
                                                {isProductRule && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                onOpenRuleDialog(rule)
                                                            }}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => deleteConfirm.requestConfirm(rule.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
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
