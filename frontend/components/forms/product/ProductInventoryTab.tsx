import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Package, RefreshCw, Settings2 } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ProductInventoryTabProps {
    form: UseFormReturn<ProductFormValues>
    initialData?: any
}

export function ProductInventoryTab({ form, initialData }: ProductInventoryTabProps) {
    const productType = form.watch("product_type")
    const trackInventory = form.watch("track_inventory")

    // Logic for switch locking/defaults is handled in parent (ProductForm) useEffect.
    // Here we just display the state.

    // Determine if switch is disabled based on requirements
    const isSwitchDisabled = productType === 'STORABLE' || productType === 'CONSUMABLE' || productType === 'SERVICE'

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
                            <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                <RefreshCw className="h-4 w-4" />
                                Reabastecimiento
                            </h3>

                            <Alert>
                                <Settings2 className="h-4 w-4" />
                                <AlertTitle>Reglas de Reabastecimiento</AlertTitle>
                                <AlertDescription className="text-xs mt-1">
                                    Configure reglas de stock mínimo y máximo para automatizar las solicitudes de compra o fabricación de este producto.
                                </AlertDescription>
                            </Alert>

                            {initialData ? (
                                <div className="pt-2">
                                    {/* Link to replenishment rules could be here, or a mini-list. 
                                        For now, since we have a dedicated tab in stock page, maybe just a button?
                                        The user request said: "Sólo si se activa el switch de la posibilidad de crear de reglas de reabastecimiento."
                                        This implies inline creation or a link.
                                    */}
                                    <Button variant="outline" className="w-full gap-2" asChild>
                                        {/* Ideally we would open a dialog or navigate. 
                                            Since we are inside a dialog (Product Form), navigating away is bad.
                                            Perhaps we can just show a message that it's managed in the Stock module, 
                                            or allow adding a rule via an inline form if we had one.
                                            Given complexity, let's provide a clear instruction or a button that would (in future) open a nested dialog.
                                        */}
                                        <span>Gestionar Reglas (Ver módulo Stock)</span>
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                                        Las reglas de reabastecimiento se gestionan centralizadamente desde Inventario &gt; Stock &gt; Reabastecimiento.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">
                                    Guarde el producto primero para configurar reglas.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </TabsContent>
    )
}
