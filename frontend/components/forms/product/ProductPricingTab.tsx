import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Info, Plus, Pencil, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { TabsContent } from "@/components/ui/tabs"

import { formatCurrency } from "@/lib/currency"

interface ProductPricingTabProps {
    initialData?: any
    pricingRules: any[]
    fetchPricingRules: () => void
    onOpenRuleDialog: (rule?: any) => void
}

export function ProductPricingTab({ initialData, pricingRules, fetchPricingRules, onOpenRuleDialog }: ProductPricingTabProps) {
    return (
        <TabsContent value="pricing" className="mt-0">
            <div className="space-y-4">
                <div className={cn("flex items-center justify-between p-4 rounded-xl border bg-muted/30", FORM_STYLES.card)}>
                    <div className="flex gap-4 items-center">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Info className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Políticas de Precios Dinámicas</h3>
                            <p className="text-xs text-muted-foreground">Las reglas se aplican automáticamente según la cantidad y vigencia.</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onOpenRuleDialog()}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Regla
                    </Button>
                </div>

                {!initialData && (
                    <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center px-6">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Pencil className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h4 className="font-medium text-muted-foreground">Debe crear el producto primero</h4>
                        <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">Las reglas de precios específicas requieren que el producto esté registrado en el sistema.</p>
                    </div>
                )}

                {initialData && (
                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                                    <TableHead>Nivel</TableHead>
                                    <TableHead>Descripción / Vigencia</TableHead>
                                    <TableHead>Cant. Mín</TableHead>
                                    <TableHead className="text-right">Precio / Descuento</TableHead>
                                    <TableHead className="text-center w-[100px]">Estado</TableHead>
                                    <TableHead className="text-right w-[60px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pricingRules.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                                            No hay reglas personalizadas para este producto.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pricingRules.map((rule) => {
                                        const isProductRule = rule.product !== null;
                                        return (
                                            <TableRow key={rule.id} className="group transition-colors">
                                                <TableCell>
                                                    <Badge variant={isProductRule ? "default" : "outline"} className="text-[10px] uppercase font-bold px-1.5">
                                                        {isProductRule ? "Producto" : "Categoría"}
                                                    </Badge>
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
                                                    <div className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase ${rule.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
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
                                                                onClick={async () => {
                                                                    if (confirm("¿Estás seguro de eliminar esta regla?")) {
                                                                        try {
                                                                            await api.delete(`/inventory/pricing-rules/${rule.id}/`)
                                                                            toast.success("Regla eliminada")
                                                                            fetchPricingRules()
                                                                        } catch (error) {
                                                                            toast.error("Error al eliminar la regla")
                                                                        }
                                                                    }
                                                                }}
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
            </div>
        </TabsContent>
    )
}
