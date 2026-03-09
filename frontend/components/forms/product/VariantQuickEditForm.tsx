import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Factory, Save, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"

const quickEditSchema = z.object({
  sale_price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  code: z.string().optional(),
  sale_uom: z.string().min(1, "La unidad de medida es obligatoria"),
  // For BOM assignment
  has_bom: z.boolean().default(false),
  bom_template_id: z.string().optional() // We can load a BOM specifically or create one
})

type QuickEditValues = z.infer<typeof quickEditSchema>

interface VariantQuickEditFormProps {
  variant: any
  onSaved: (updatedVariant: any) => void
  onCancel: () => void
  onTabChange?: (tab: string) => void
}

export function VariantQuickEditForm({ variant, onSaved, onCancel, onTabChange }: VariantQuickEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [availableBOMs, setAvailableBOMs] = useState<any[]>([])

  const form = useForm<QuickEditValues>({
    resolver: zodResolver(quickEditSchema) as any,
    defaultValues: {
      sale_price: variant.sale_price || 0,
      code: variant.code || "",
      sale_uom: variant.sale_uom || "",
       // Check if there is a BOM attached (requires fetching or passing it from list)
      has_bom: variant.has_active_bom || false,
    }
  })

  // Load existing BOMs for this product template if needed, or we just allow them to toggle `has_bom`
  // and in this view we can list the BOMs. Let's keep it simple for now or fetch BOMs assigned to this variant.
  
  useEffect(() => {
    form.reset({
      sale_price: variant.sale_price || 0,
      code: variant.code || "",
      sale_uom: variant.sale_uom || "",
      has_bom: variant.has_active_bom || false,
    })
    fetchVariantBOMs()
    fetchUoms()
  }, [variant])

  const [uoms, setUoms] = useState<any[]>([])

  const fetchUoms = async () => {
    try {
      const res = await api.get("/inventory/uoms/")
      setUoms(res.data.results || res.data)
    } catch (e) {
      console.error("Failed to fetch UOMs", e)
    }
  }

  const fetchVariantBOMs = async () => {
    try {
       const res = await api.get(`/production/boms/?product=${variant.id}`)
       setAvailableBOMs(res.data.results || res.data)
    } catch (e) {
       console.error("Failed to fetch variant boms", e)
    }
  }

  const onSubmit = async (data: QuickEditValues) => {
    // Construct the updated variant locally
    const updatedVariant = {
        ...variant,
        sale_price: data.sale_price,
        code: data.code,
        sale_uom: data.sale_uom || null,
        has_active_bom: data.has_bom,
        product_type: data.has_bom ? "MANUFACTURABLE" : variant.product_type
    }
    
    // Instead of saving directly to the API, we pass it up
    // so it can be saved with the main product form
    onSaved(updatedVariant)
    toast.success("Borrador de variante actualizado", {
        description: "Recuerde guardar el producto para aplicar los cambios."
    })
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between p-4 border-b bg-muted/10">
        <div>
           <Badge variant="outline" className="mb-1 text-[10px] font-mono">{variant.internal_code || 'SIN SKU'}</Badge>
           <h3 className="font-bold text-sm leading-tight">{variant.variant_display_name || variant.name}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 overflow-y-auto flex-1 scrollbar-thin">
        <Form {...form}>
          <div className="space-y-4">
             
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Precio de Venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} className="h-8 text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="sale_uom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Ud. Medida Venta</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Seleccione UoM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {uoms.map((u) => (
                              <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SKU / Código de Barras</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-8 text-sm font-mono" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
             </div>

             <div className="pt-4 border-t border-dashed mt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Factory className="h-3 w-3" /> Producción
                </h4>
                
                <FormField
                  control={form.control}
                  name="has_bom"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-muted/5">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs">Requiere Lista de Materiales (BOM)</FormLabel>
                        <FormDescription className="text-[10px]">
                          Para fabricar stock de esta variante se consumirán materiales.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("has_bom") && (
                    <div className="p-3 border rounded-lg bg-orange-50/50 border-orange-200/50 space-y-3">
                        <p className="text-[11px] text-muted-foreground leading-tight">
                            BOMs Activos: <strong>{availableBOMs.length}</strong>
                        </p>
                        {availableBOMs.length === 0 ? (
                            <Button type="button" variant="outline" size="sm" className="w-full text-xs h-7 border-dashed">
                                <Plus className="h-3 w-3 mr-1" /> Crear BOM para Variante
                            </Button>
                        ) : (
                             <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="w-full text-xs h-7"
                                onClick={() => onTabChange?.("manufacturing")}
                             >
                                Gestionar BOMs
                            </Button>
                        )}
                    </div>
                )}
             </div>

          </div>
        </Form>
      </div>

      <div className="p-4 border-t bg-muted/10 flex justify-end gap-2">
         <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">
            Cancelar
         </Button>
         <Button 
            type="button" 
            onClick={form.handleSubmit(onSubmit)}
            size="sm" 
            className="text-xs font-bold shadow-sm"
            disabled={loading}
         >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            <Save className="h-3 w-3 mr-2" />
            Guardar Cambios
         </Button>
      </div>
    </div>
  )
}
