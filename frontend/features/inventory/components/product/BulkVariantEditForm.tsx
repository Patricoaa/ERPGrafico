"use client"

import { useState, useEffect } from "react"
import { useForm, SubmitHandler, UseFormReturn } from "react-hook-form"
import { Product, UoM } from "@/types/entities"
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
  copy_bom_from: z.string().optional(),
})

interface BulkEditValues {
  sale_price?: string
  sale_uom?: string
  has_bom?: boolean
  apply_has_bom?: boolean
  copy_bom_from?: string
}

interface BulkVariantEditFormProps {
  selectedVariants: Product[]
  availableVariants?: Product[] // All variants of the product to use as BOM sources
  onSaved: (updatedVariants: Product[]) => void
  onCancel: () => void
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BulkVariantEditForm({ selectedVariants, availableVariants = [], onSaved, onCancel }: BulkVariantEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [uoms, setUoms] = useState<UoM[]>([])

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

  const form: UseFormReturn<BulkEditValues> = useForm<BulkEditValues>({
    resolver: zodResolver(bulkEditSchema),
    defaultValues: {
      apply_has_bom: false,
      has_bom: true,
      sale_price: undefined,
      sale_uom: undefined,
      copy_bom_from: undefined,
    }
  })

  const onSubmit: SubmitHandler<BulkEditValues> = async (data) => {
    setLoading(true)
    const payload: Partial<Product> & { copy_bom_from?: number } = {}
    if (data.sale_price !== undefined && data.sale_price !== "") payload.sale_price = Number(data.sale_price)
    if (data.sale_uom !== undefined && data.sale_uom !== "" && data.sale_uom !== "none") payload.sale_uom = Number(data.sale_uom)
    if (data.apply_has_bom) {
        payload.has_bom = data.has_bom
        if (data.has_bom) payload.product_type = "MANUFACTURABLE"
    }
    if (data.copy_bom_from && data.copy_bom_from !== "" && data.copy_bom_from !== "none") {
        payload.copy_bom_from = Number(data.copy_bom_from)
        payload.has_bom = true
        payload.product_type = "MANUFACTURABLE"
    }

    if (Object.keys(payload).length === 0) {
        toast.info("No se seleccionaron cambios masivos.")
        setLoading(false)
        return
    }

    // Apply changes locally to the selected variants
    const updatedVariants = selectedVariants.map(v => {
        return {
            ...v,
            sale_price: payload.sale_price !== undefined ? payload.sale_price : v.sale_price,
            sale_uom: payload.sale_uom !== undefined ? payload.sale_uom : v.sale_uom,
            has_active_bom: payload.copy_bom_from !== undefined ? true : (payload.has_bom !== undefined ? payload.has_bom : v.has_active_bom),
            product_type: payload.product_type !== undefined ? payload.product_type : v.product_type,
            copy_bom_from: payload.copy_bom_from
        }
    })

    toast.success(`${selectedVariants.length} variantes actualizadas en borrador. Guarde el producto base.`)
    onSaved(updatedVariants as Product[])
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-primary/10/30 rounded-md border border-primary/10 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between p-4 border-b bg-primary/10/80">
        <div>
           <div className="flex items-center gap-2 mb-1">
               <Sparkles className="h-4 w-4 text-primary" />
               <h3 className="font-bold text-sm text-primary leading-tight">Edición Masiva</h3>
           </div>
           <p className="text-[11px] text-primary/80 font-medium">{selectedVariants.length} variantes seleccionadas</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/10/50">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 overflow-y-auto flex-1 scrollbar-thin">
        <Form {...form}>
          <div className="space-y-4">
             <div className="text-[11px] text-muted-foreground mb-4 leading-relaxed bg-white/50 p-3 rounded-md border border-primary/10/50">
                 Deje en blanco los campos que <strong>no desea alterar</strong>. Solo se aplicarán los campos con valores rellenados.
             </div>

             <div className="grid grid-cols-2 gap-4">
                <FormField<BulkEditValues>
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Precio de Venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={String(field.value || "")} placeholder="Sin cambios" className="h-8 text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                 <FormField<BulkEditValues>
                  control={form.control}
                  name="sale_uom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Ud. Medida Venta</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value || "")}>
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

             <div className="pt-4 border-t border-dashed border-primary/20 mt-4 space-y-4">
                 
                 <FormField<BulkEditValues>
                  control={form.control}
                  name="apply_has_bom"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-xs font-bold text-primary">Actualizar requisito de LdM masivamente</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch("apply_has_bom") && (
                    <FormField<BulkEditValues>
                      control={form.control}
                      name="has_bom"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-white/50 animate-in fade-in duration-200">
                          <FormControl>
                            <Checkbox
                              checked={Boolean(field.value)}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs">Todas las seleccionadas requieren Lista de Materiales</FormLabel>
                            <FormDescription className="text-[10px]">
                              Forzará a las {selectedVariants.length} variantes a ser Fabricables y requerir LdM.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                )}

                <FormField<BulkEditValues>
                  control={form.control}
                  name="copy_bom_from"
                  render={({ field }) => (
                    <FormItem className="space-y-2 pt-2 border-t border-dashed border-primary/20">
                      <FormLabel className="text-xs font-bold text-primary">Copiar Receta (BOM) desde:</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value || "")}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm bg-white/70 border-primary/20">
                            <SelectValue placeholder="Ninguna / Sin cambios" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                           <SelectItem value="none" className="italic text-muted-foreground">No copiar receta</SelectItem>
                           {availableVariants
                             .filter(v => v.has_active_bom)
                             .map((v) => (
                               <SelectItem key={v.id} value={v.id.toString()}>
                                 {v.variant_display_name || v.name} ({v.internal_code || v.code})
                               </SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-[10px]">
                        Elegir variante que ya tenga una LdM configurada para replicarla.
                      </FormDescription>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
             </div>

          </div>
        </Form>
      </div>

      <div className="p-4 border-t border-primary/10 bg-white/50 flex justify-end gap-2">
         <Button variant="outline" size="sm" onClick={onCancel} className="text-xs border-primary/20 text-primary hover:bg-primary/10">
            Cancelar
         </Button>
         <Button 
            type="button" 
            onClick={form.handleSubmit(onSubmit)} 
            size="sm" 
            className="text-xs font-bold shadow-sm bg-primary hover:bg-primary text-white"
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
