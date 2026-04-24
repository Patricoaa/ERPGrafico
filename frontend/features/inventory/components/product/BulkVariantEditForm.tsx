"use client"

import { useState, useEffect } from "react"
import { useForm, SubmitHandler, UseFormReturn } from "react-hook-form"
import { Product, UoM } from "@/types/entities"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect } from "@/components/shared"
import { CancelButton, SubmitButton, IconButton } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { Save, X, Sparkles } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const bulkEditSchema = z.object({
    sale_price: z.string().optional(),
    sale_uom: z.string().optional(),
    has_bom: z.boolean().default(false),
    apply_has_bom: z.boolean().default(false),
    copy_bom_from: z.string().optional(),
})

type BulkEditValues = z.infer<typeof bulkEditSchema>

interface BulkVariantEditFormProps {
    selectedVariants: Product[]
    availableVariants?: Product[]
    onSaved: (updatedVariants: Product[]) => void
    onCancel: () => void
}

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

    const form = useForm<BulkEditValues>({
        resolver: zodResolver(bulkEditSchema) as any,
        defaultValues: {
            apply_has_bom: false,
            has_bom: true,
            sale_price: "",
            sale_uom: "",
            copy_bom_from: "",
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
        <div className="flex flex-col h-full bg-card rounded-lg border-2 border-primary/10 shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between p-5 border-b-2 border-primary/10 bg-primary/5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h3 className="font-black text-sm uppercase tracking-widest text-primary">Edición Masiva de Variantes</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tight">{selectedVariants.length} variantes seleccionadas para modificación</p>
                </div>
                <IconButton onClick={onCancel} className="h-9 w-9 rounded-full bg-background border-2 border-primary/10 hover:bg-destructive hover:text-white hover:border-destructive transition-all">
                    <X className="h-4 w-4" />
                </IconButton>
            </div>

            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
                <Form {...form}>
                    <div className="space-y-8">
                        <div className="text-[11px] text-primary/80 font-bold leading-relaxed bg-primary/5 p-4 rounded-lg border-2 border-primary/10 border-dashed">
                            Los campos en blanco <strong>no sufrirán cambios</strong>. Solo se aplicarán las propiedades con valores explícitos.
                        </div>

                        <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 border-primary/10">
                            <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Precios y Logística</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField<BulkEditValues>
                                    control={form.control}
                                    name="sale_price"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            name={field.name}
                                            ref={field.ref}
                                            value={(field.value as string) ?? ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            label="Precio de Venta"
                                            type="number"
                                            step="0.01"
                                            placeholder="Mantener actual"
                                            error={fieldState.error?.message}
                                            className="font-black"
                                        />
                                    )}
                                />
                                <FormField<BulkEditValues>
                                    control={form.control}
                                    name="sale_uom"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Ud. Medida Venta"
                                            value={(field.value as string) || ""}
                                            onChange={field.onChange}
                                            options={[
                                                { label: "--- Mantener actual ---", value: "" },
                                                ...uoms.map(u => ({ label: u.name, value: u.id.toString() }))
                                            ]}
                                            error={fieldState.error?.message}
                                            className="h-11 font-black"
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 border-primary/10">
                            <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Configuración Industrial</span>
                            </div>

                            <div className="space-y-6">
                                <FormField<BulkEditValues>
                                    control={form.control}
                                    name="apply_has_bom"
                                    render={({ field }) => (
                                        <div className={cn(
                                            "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                                            field.value ? "bg-primary/5 border-primary/20" : "bg-background border-dashed border-muted-foreground/20"
                                        )}>
                                            <div className="space-y-1">
                                                <label className="text-xs font-black uppercase tracking-widest text-primary">Sincronizar Requisito de LdM</label>
                                                <p className="text-[10px] text-muted-foreground font-medium leading-tight">Actualizar masivamente si las variantes requieren fabricación.</p>
                                            </div>
                                            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} className="h-5 w-5" />
                                        </div>
                                    )}
                                />

                                {form.watch("apply_has_bom") && (
                                    <FormField<BulkEditValues>
                                        control={form.control}
                                        name="has_bom"
                                        render={({ field }) => (
                                            <div className="flex flex-row items-center justify-between space-x-3 rounded-lg border-2 p-4 bg-background animate-in fade-in zoom-in-95 duration-200">
                                                <div className="space-y-1 leading-none">
                                                    <label className="text-xs font-bold uppercase">Requieren Lista de Materiales</label>
                                                    <p className="text-[10px] text-muted-foreground font-medium italic">
                                                        Forzará a las {selectedVariants.length} variantes a ser Fabricables.
                                                    </p>
                                                </div>
                                                <Checkbox
                                                    checked={!!field.value}
                                                    onCheckedChange={field.onChange}
                                                    className="h-5 w-5"
                                                />
                                            </div>
                                        )}
                                    />
                                )}

                                <FormField<BulkEditValues>
                                    control={form.control}
                                    name="copy_bom_from"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Copiar Receta (BOM) desde:"
                                            value={(field.value as string) || ""}
                                            onChange={field.onChange}
                                            options={[
                                                { label: "--- No copiar / Sin cambios ---", value: "" },
                                                ...availableVariants
                                                    .filter(v => v.has_active_bom)
                                                    .map(v => ({
                                                        label: `${v.variant_display_name || v.name} (${v.internal_code || v.code})`,
                                                        value: v.id.toString()
                                                    }))
                                            ]}
                                            error={fieldState.error?.message}
                                            hint="Elegir una variante origen con LdM configurada para replicarla en todas."
                                            className="h-11 font-black"
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </Form>
            </div>

            <div className="p-5 border-t-2 border-primary/10 bg-primary/5 flex justify-end gap-3">
                <CancelButton onClick={onCancel} className="font-black uppercase tracking-widest text-[10px]" />
                <SubmitButton
                    type="button"
                    onClick={() => {
                        form.handleSubmit(onSubmit as any)()
                    }}
                    className="font-black uppercase tracking-widest text-[10px] px-6"
                    loading={loading}
                    icon={<Save className="h-4 w-4 mr-2" />}
                >
                    Actualizar {selectedVariants.length} Variantes
                </SubmitButton>
            </div>
        </div>
    )
}
