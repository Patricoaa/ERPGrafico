import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, RefreshCw, Settings2, Plus, Pencil, Trash2 } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ReplenishmentRuleForm } from "../ReplenishmentRuleForm"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
    reorderingRules?: any[]
    setReorderingRules?: (rules: any[]) => void
    warehouses?: any[]
}

export function ProductInventoryTab({ form, initialData, reorderingRules = [], setReorderingRules, warehouses = [] }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")
    const trackInventory = form.watch("track_inventory")

    const [ruleModalOpen, setRuleModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<any>(null)

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE'

    const handleSaveRule = (data: any) => {
        if (!setReorderingRules) return

        if (editingRule) {
            // Update existing
            const updated = reorderingRules.map(r => {
                // Match by ID or temp ID
                if (r.id && r.id === editingRule.id) return { ...r, ...data }
                if (r._tempId && r._tempId === editingRule._tempId) return { ...r, ...data }
                return r
            })
            setReorderingRules(updated)
        } else {
            // Create new
            const newRule = { ...data, _tempId: Date.now() }
            setReorderingRules([...reorderingRules, newRule])
        }
        setEditingRule(null)
    }

    const handleEditRule = (rule: any) => {
        setEditingRule(rule)
        setRuleModalOpen(true)
    }

    const handleDeleteRule = (rule: any) => {
        if (!setReorderingRules) return
        setReorderingRules(reorderingRules.filter(r => r !== rule))
    }

    return (
        <TabsContent value="inventory" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl border bg-card/50">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                            <Package className="h-4 w-4" />
                            Control de Inventario
                        </h3>

                        <FormField<ProductFormValues>
                            control={form.control}
                            name="track_inventory"
                            render={({ field }) => (
                                <div className="space-y-4">
                                    {productType === 'MANUFACTURABLE' ? (
                                        <div className="flex items-center justify-between p-4 rounded-xl border bg-primary/5 border-primary/20">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <FormLabel className="text-xs font-bold">Control de Inventario</FormLabel>
                                                    <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 uppercase font-black">Automático</Badge>
                                                </div>
                                                <FormDescription className="text-[10px]">
                                                    Gestionado por el Modo de Producción seleccionado.
                                                </FormDescription>
                                            </div>
                                            <div className="flex items-center gap-2 cursor-help" title={field.value ? "Activado (Simple/Lote)" : "Desactivado (Sobre Pedido)"}>
                                                <Switch
                                                    checked={field.value}
                                                    disabled
                                                    className="opacity-50"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <FormItem className="flex items-center justify-between p-4 rounded-xl border bg-background/50">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs font-bold">Controlar Stock</FormLabel>
                                                <FormDescription className="text-[10px]">
                                                    {productType === 'STORABLE' ? 'Obligatorio para productos almacenables.' :
                                                        productType === 'SERVICE' || productType === 'CONSUMABLE' ? 'Desactivado para servicios y consumibles.' :
                                                            'Habilitar si desea rastrear cantidades en stock.'}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isSwitchDisabled}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}

                                    {field.value && initialData && (
                                        <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20 rounded-lg border border-dashed">
                                            <div className="flex flex-col items-center bg-background rounded p-2 shadow-sm">
                                                <span className="text-[10px] uppercase text-muted-foreground font-bold">A Mano</span>
                                                <span className="text-lg font-bold tabular-nums">{initialData.current_stock || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-amber-50 rounded p-2 shadow-sm border border-amber-100">
                                                <span className="text-[10px] uppercase text-amber-700 font-bold">Reservado</span>
                                                <span className="text-lg font-bold tabular-nums text-amber-700">{initialData.qty_reserved || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-emerald-50 rounded p-2 shadow-sm border border-emerald-100">
                                                <span className="text-[10px] uppercase text-emerald-700 font-bold">Disponible</span>
                                                <span className="text-lg font-bold tabular-nums text-emerald-700">{initialData.qty_available || 0}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Replenishment Rules section - Only visible if tracking inventory */}
                    {trackInventory && (
                        <div className="p-6 rounded-2xl border bg-card/50 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                    <RefreshCw className="h-4 w-4" />
                                    Reglas de Reabastecimiento
                                </h3>
                                {setReorderingRules && (
                                    <Button size="sm" variant="outline" onClick={() => { setEditingRule(null); setRuleModalOpen(true); }}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Agregar Regla
                                    </Button>
                                )}
                            </div>

                            {reorderingRules.length === 0 ? (
                                <Alert>
                                    <Settings2 className="h-4 w-4" />
                                    <AlertTitle>Sin reglas configuradas</AlertTitle>
                                    <AlertDescription className="text-xs mt-1">
                                        No hay reglas de reabastecimiento. Agregue una para automatizar pedidos.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="rounded-md border bg-background/50 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="h-8 hover:bg-transparent">
                                                <TableHead className="h-8 text-[10px] font-bold">Almacén</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-right">Mín</TableHead>
                                                <TableHead className="h-8 text-[10px] font-bold text-right">Max</TableHead>
                                                <TableHead className="h-8 w-[60px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reorderingRules.map((rule, idx) => {
                                                const wName = warehouses.find(w => w.id.toString() === rule.warehouse?.toString())?.name || rule.warehouse_name || "Desconocido"
                                                return (
                                                    <TableRow key={rule.id || rule._tempId || idx} className="h-9">
                                                        <TableCell className="text-xs font-medium">{wName}</TableCell>
                                                        <TableCell className="text-xs text-right tabular-nums">{rule.min_quantity}</TableCell>
                                                        <TableCell className="text-xs text-right tabular-nums">{rule.max_quantity}</TableCell>
                                                        <TableCell className="text-right">
                                                            {setReorderingRules && (
                                                                <div className="flex justify-end gap-1">
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditRule(rule)}>
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteRule(rule)}>
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>

            {setReorderingRules && (
                <ReplenishmentRuleForm
                    open={ruleModalOpen}
                    onOpenChange={setRuleModalOpen}
                    onSave={handleSaveRule}
                    initialData={editingRule}
                    warehouses={warehouses}
                />
            )}
        </TabsContent>
    )
}
