import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, X, Sparkles } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

const bulkEditSchema = z.object({
  sale_price: z.string().optional(), // String to allow 'empty' implying no change
  sale_uom: z.string().optional(),
  // For BOM assignment
  has_bom: z.boolean().default(false),
  apply_has_bom: z.boolean().default(false),
})

type BulkEditValues = z.infer<typeof bulkEditSchema>

interface BulkVariantEditFormProps {
  selectedVariants: any[]
  onSaved: (updatedVariants: any[]) => void
  onCancel: () => void
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect } from "react"

export function BulkVariantEditForm({ selectedVariants, onSaved, onCancel }: BulkVariantEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [uoms, setUoms] = useState<any[]>([])

  useEffect(() => {
    fetchUoms()
  }, [])

  const fetchUoms = async () => {
    try {
      const res = await api.get("/inventory/uoms/")
      setUoms(res.data.results || res.data)
    } catch (e) {
      console.error("Failed to fetch UOMs", e)
    }
  }

  const form = useForm<BulkEditValues>({
    resolver: zodResolver(bulkEditSchema) as any,
    defaultValues: {
      sale_price: "",
      sale_uom: "",
      has_bom: false,
      apply_has_bom: false,
    }
  })

  const onSubmit = async (data: BulkEditValues) => {
    const payload: any = {}
    if (data.sale_price !== "") payload.sale_price = Number(data.sale_price)
    if (data.sale_uom !== "") payload.sale_uom = Number(data.sale_uom)
    if (data.apply_has_bom) {
        payload.has_bom = data.has_bom
        if (data.has_bom) payload.product_type = "MANUFACTURABLE"
    }

    if (Object.keys(payload).length === 0) {
        toast.info("No se seleccionaron cambios masivos.")
        return
    }

    // Apply changes locally to the selected variants
    const updatedVariants = selectedVariants.map(v => {
        return {
            ...v,
            sale_price: payload.sale_price !== undefined ? payload.sale_price : v.sale_price,
            sale_uom: payload.sale_uom !== undefined ? payload.sale_uom : v.sale_uom,
            has_active_bom: payload.has_bom !== undefined ? payload.has_bom : v.has_active_bom,
            product_type: payload.product_type !== undefined ? payload.product_type : v.product_type
        }
    })

    toast.success(`${selectedVariants.length} variantes actualizadas en borrador. Guarde el producto base.`)
    onSaved(updatedVariants)
  }

  return (
    <div className="flex flex-col h-full bg-blue-50/30 rounded-2xl border border-blue-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between p-4 border-b bg-blue-50/80">
        <div>
           <div className="flex items-center gap-2 mb-1">
               <Sparkles className="h-4 w-4 text-blue-600" />
               <h3 className="font-bold text-sm text-blue-900 leading-tight">Edición Masiva</h3>
           </div>
           <p className="text-[11px] text-blue-700/80 font-medium">{selectedVariants.length} variantes seleccionadas</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-blue-700/60 hover:text-blue-900 hover:bg-blue-100/50">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 overflow-y-auto flex-1 scrollbar-thin">
        <Form {...form}>
          <div className="space-y-4">
             <div className="text-[11px] text-muted-foreground mb-4 leading-relaxed bg-white/50 p-3 rounded-lg border border-blue-100/50">
                 Deje en blanco los campos que <strong>no desea alterar</strong>. Solo se aplicarán los campos con valores rellenados.
             </div>

             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Precio de Venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="Sin cambios" className="h-8 text-sm" />
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
                            <SelectValue placeholder="Sin cambios" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value="none" className="italic text-muted-foreground">Sin cambios</SelectItem>
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

             <div className="pt-4 border-t border-dashed border-blue-200 mt-4 space-y-4">
                 
                 <FormField
                  control={form.control}
                  name="apply_has_bom"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-xs font-bold text-blue-900">Actualizar requisito de BOM masivamente</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch("apply_has_bom") && (
                    <FormField
                      control={form.control}
                      name="has_bom"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-white/50 animate-in fade-in duration-200">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs">Todas las seleccionadas requieren BOM</FormLabel>
                            <FormDescription className="text-[10px]">
                              Forzará a las {selectedVariants.length} variantes a ser Fabricables y requerir BOM.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                )}
             </div>

          </div>
        </Form>
      </div>

      <div className="p-4 border-t border-blue-100 bg-white/50 flex justify-end gap-2">
         <Button variant="outline" size="sm" onClick={onCancel} className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
            Cancelar
         </Button>
         <Button 
            type="button" 
            onClick={form.handleSubmit(onSubmit)} 
            size="sm" 
            className="text-xs font-bold shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading}
         >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            <Save className="h-3 w-3 mr-2" />
            Aplicar a {selectedVariants.length} Variantes
         </Button>
      </div>
    </div>
  )
}
