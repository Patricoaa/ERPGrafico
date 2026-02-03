import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, Truck } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Switch } from "@/components/ui/switch"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ProductBasicInfoProps {
    form: UseFormReturn<ProductFormValues>
    categories: any[]
    isEditing: boolean
    onAddCategory: () => void
}

export function ProductIdentitySection({ form, isEditing }: { form: UseFormReturn<ProductFormValues>, isEditing: boolean }) {
    return (
        <div className="p-4 rounded-2xl border bg-primary/5 space-y-4 border-primary/10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                    {isEditing ? (
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="internal_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>ID Interno</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-xl border border-primary/20">
                                            <Plus className="h-3 w-3 text-primary" />
                                            <Input {...field} readOnly className="bg-transparent border-none p-0 h-auto font-mono font-black text-primary shadow-none focus-visible:ring-0" />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 p-4 text-center">
                            <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter italic">ID Automático</span>
                        </div>
                    )}
                </div>

                <div className="md:col-span-6">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Nombre del Producto</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ej: Camiseta de Algodón Premium"
                                        {...field}
                                        className={cn(FORM_STYLES.input, "text-lg font-bold shadow-sm")}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="md:col-span-3">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>SKU / Código EAN</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: 100000001" {...field} className={cn(FORM_STYLES.input, "font-bold")} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>
        </div>
    )
}

export function ProductCategorizationSection({ form, categories, isEditing, onAddCategory }: ProductBasicInfoProps) {
    return (
        <div className="p-4 rounded-2xl border bg-card/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-primary rounded-full" />
                Categorización
            </h3>

            <FormField<ProductFormValues>
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Categoría del Producto</FormLabel>
                        <div className="flex gap-2">
                            <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                                <FormControl>
                                    <SelectTrigger className={FORM_STYLES.input}>
                                        <SelectValue placeholder="Seleccionar categoría" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!isEditing && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 h-11 w-11 rounded-xl"
                                    onClick={onAddCategory}
                                    title="Nueva Categoría"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    )
}

export function ProductStatusSection({ form }: { form: UseFormReturn<ProductFormValues> }) {
    return (
        <div className="p-4 rounded-2xl border bg-card/50 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                Estado y Visibilidad
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField<ProductFormValues>
                    control={form.control}
                    name="can_be_sold"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 rounded-xl bg-background border border-dashed transition-colors hover:border-emerald-500/30">
                            <div className="space-y-0.5">
                                <FormLabel className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                                    <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                                    Venta
                                </FormLabel>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={['CONSUMABLE', 'SUBSCRIPTION'].includes(form.watch("product_type"))}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <FormField<ProductFormValues>
                    control={form.control}
                    name="can_be_purchased"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 rounded-xl bg-background border border-dashed transition-colors hover:border-amber-500/30">
                            <div className="space-y-0.5">
                                <FormLabel className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                                    <Truck className="h-3.5 w-3.5 text-amber-600" />
                                    Compra
                                </FormLabel>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    )
}

export function ProductBasicInfo({ form, categories, isEditing, onAddCategory }: ProductBasicInfoProps) {
    return (
        <div className="space-y-4">
            <ProductIdentitySection form={form} isEditing={isEditing} />
            <ProductCategorizationSection form={form} categories={categories} isEditing={isEditing} onAddCategory={onAddCategory} />
            <ProductStatusSection form={form} />
        </div>
    )
}
