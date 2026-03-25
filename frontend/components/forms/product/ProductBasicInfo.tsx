import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, Truck, Search, ChevronsUpDown, Check, Barcode } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Switch } from "@/components/ui/switch"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { BarcodeDialog } from "@/components/inventory/BarcodeDialog"
import { useState } from "react"

export interface ProductBasicInfoProps {
    form: UseFormReturn<ProductFormValues>
    categories: any[]
    isEditing: boolean
    onAddCategory: () => void
}

export function ProductBasicInfo({ form, categories, isEditing, onAddCategory }: ProductBasicInfoProps) {
    const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false)

    return (
        <div className="space-y-6">
            {/* Información Principal */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Información Principal</span>
                    <div className="flex-1 h-px bg-border" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2">
                        {isEditing ? (
                            <FormField<ProductFormValues>
                                control={form.control}
                                name="internal_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>ID Interno</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2 py-2">
                                                <span className="text-muted-foreground text-xs">#</span>
                                                <Input {...field} readOnly className="bg-transparent border-none p-0 h-auto font-mono font-black text-primary shadow-none focus-visible:ring-0" />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>ID Interno</FormLabel>
                                <div className="py-2">
                                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter italic">ID Automático</span>
                                </div>
                            </FormItem>
                        )}
                    </div>

                    <div className="md:col-span-7">
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
                                            className={cn(FORM_STYLES.input, "text-base font-bold")}
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
                                        <div className="flex gap-2">
                                            <Input placeholder="Ej: 100000001" {...field} className={cn(FORM_STYLES.input, "font-mono font-bold")} />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0 h-10 w-10 rounded-xl"
                                                onClick={() => setIsBarcodeDialogOpen(true)}
                                                title="Gestionar Código de Barras"
                                            >
                                                <Barcode className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                    <BarcodeDialog
                                        open={isBarcodeDialogOpen}
                                        onOpenChange={setIsBarcodeDialogOpen}
                                        initialValue={field.value}
                                        onApply={(val) => form.setValue("code", val, { shouldDirty: true, shouldValidate: true })}
                                    />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-6">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Categoría del Producto</FormLabel>
                                    <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        disabled={isEditing}
                                                        className={cn("w-full justify-between font-normal h-10 rounded-xl", !field.value && "text-muted-foreground", FORM_STYLES.input)}
                                                    >
                                                        {field.value
                                                            ? categories.find((cat) => cat.id.toString() === field.value.toString())?.name
                                                            : "Seleccionar categoría"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                <div className="p-2">
                                                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        <input
                                                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            placeholder="Buscar categoría..."
                                                            onChange={(e) => {
                                                                const val = e.target.value.toLowerCase()
                                                                const inputs = document.querySelectorAll('.category-item')
                                                                inputs.forEach((el) => {
                                                                    if (el.textContent?.toLowerCase().includes(val)) {
                                                                        (el as HTMLElement).style.display = 'flex'
                                                                    } else {
                                                                        (el as HTMLElement).style.display = 'none'
                                                                    }
                                                                })
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                        {categories.map((cat) => (
                                                            <div
                                                                key={cat.id}
                                                                className={cn(
                                                                    "category-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                    field.value === cat.id.toString() && "bg-accent"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange(cat.id.toString())
                                                                    document.body.click()
                                                                }}
                                                            >
                                                                <span>{cat.name}</span>
                                                                {field.value === cat.id.toString() && (
                                                                    <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                )}
                                                            </div>
                                                        ))}
                                                        {categories.length === 0 && (
                                                            <div className="p-4 text-sm text-center text-muted-foreground">
                                                                No hay categorías
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        {!isEditing && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0 h-10 w-10 rounded-xl"
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

                    <div className="md:col-span-6 flex items-center gap-6 pb-2">
                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_sold"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={['CONSUMABLE', 'SUBSCRIPTION'].includes(form.watch("product_type"))}
                                        />
                                    </FormControl>
                                    <div className="space-y-0.5">
                                        <FormLabel className={cn(FORM_STYLES.label, "flex items-center gap-2 cursor-pointer")}>
                                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                                            Habilitar para Venta
                                        </FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField<ProductFormValues>
                            control={form.control}
                            name="can_be_purchased"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={form.watch("product_type") === 'MANUFACTURABLE'}
                                        />
                                    </FormControl>
                                    <div className="space-y-0.5">
                                        <FormLabel className={cn(FORM_STYLES.label, "flex items-center gap-2 cursor-pointer")}>
                                            <Truck className="h-3.5 w-3.5 text-amber-600" />
                                            Habilitar para Compra
                                        </FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
