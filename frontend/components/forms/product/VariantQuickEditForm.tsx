import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Factory, Save, X, Layers, Settings2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"

const quickEditSchema = z.object({
  sale_price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  code: z.string().optional(),
  sale_uom: z.string().min(1, "La unidad de medida es obligatoria"),
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
    }
  })

  useEffect(() => {
    form.reset({
      sale_price: variant.sale_price || 0,
      code: variant.code || "",
      sale_uom: variant.sale_uom || "",
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

  // Auto-save logic: apply changes to parent form whenever a field changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      // Only trigger if a field was actually changed by the user (type === 'change')
      if (type === 'change') {
        const data = form.getValues();
        const updatedVariant = {
          ...variant,
          sale_price: data.sale_price,
          code: data.code,
          sale_uom: data.sale_uom || null,
          has_active_bom: true, // Force to true as per user request
          product_type: "MANUFACTURABLE" // All variants are manufacturable now
        };
        onSaved(updatedVariant);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, variant, onSaved]);

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between p-4 border-b bg-muted/10">
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-xl bg-primary/10">
             <Layers className="h-4 w-4 text-primary" />
           </div>
           <div>
              <Badge variant="outline" className="mb-0.5 text-[10px] font-mono">{variant.internal_code || 'SIN SKU'}</Badge>
              <h3 className="font-bold text-sm leading-tight">{variant.variant_display_name || variant.name}</h3>
           </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
        <Form {...form}>
          <div className="space-y-6">
             
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground">Precio de Venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} className="h-10 font-bold" />
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
                      <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground">Ud. Medida Venta</FormLabel>
                      <Select onValueChange={(val) => {
                          field.onChange(val);
                          // Force a change event to trigger the effect immediately for Select
                          form.setValue("sale_uom", val, { shouldDirty: true });
                      }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Seleccione UoM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent align="end">
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

             <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground">SKU / Código de Barras</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10 font-mono" placeholder="Ej: VAR-001" />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

             <div className="pt-6 border-t border-dashed space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Factory className="h-3.5 w-3.5" /> Recetas de Producción
                  </h4>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px]">
                    LdM REQUERIDA
                  </Badge>
                </div>
                
                <div className="p-4 border rounded-2xl bg-muted/5 border-dashed space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-muted-foreground">
                            Recetas configuradas: <span className="text-foreground font-bold">{availableBOMs.length}</span>
                        </p>
                    </div>

                    {availableBOMs.length === 0 ? (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs h-9 border-dashed rounded-xl gap-2 text-primary hover:bg-primary/5 hover:border-primary/40"
                          onClick={() => onTabChange?.("manufacturing")}
                        >
                            <Plus className="h-3.5 w-3.5" /> Crear Primera Receta
                        </Button>
                    ) : (
                         <Button 
                            type="button" 
                            variant="secondary" 
                            size="sm" 
                            className="w-full text-xs h-9 rounded-xl gap-2 font-bold"
                            onClick={() => onTabChange?.("manufacturing")}
                         >
                            <Settings2 className="h-3.5 w-3.5" /> Gestionar Listas de Materiales
                        </Button>
                    )}
                </div>
                
                <p className="text-[10px] text-muted-foreground italic text-center px-4">
                  Los cambios realizados se guardan automáticamente como borrador local.
                </p>
             </div>

          </div>
        </Form>
      </div>
    </div>
  )
}
