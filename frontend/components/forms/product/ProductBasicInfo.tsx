import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, Truck } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Switch } from "@/components/ui/switch"

interface ProductBasicInfoProps {
    form: UseFormReturn<ProductFormValues>
    categories: any[]
    isEditing: boolean
    onAddCategory: () => void
}

export function ProductBasicInfo({ form, categories, isEditing, onAddCategory }: ProductBasicInfoProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
                {isEditing && (
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="internal_code"
                        render={({ field }) => (
                            <FormItem className="mb-4">
                                <FormLabel className="text-primary font-bold">Código Interno</FormLabel>
                                <FormControl>
                                    <Input {...field} readOnly className="bg-primary/5 font-mono font-bold border-primary/20" />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
                <FormField<ProductFormValues>
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Código / SKU</FormLabel>
                            <FormControl>
                                <Input placeholder="AUTO-GEN" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="md:col-span-3">
                <FormField<ProductFormValues>
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre Comercial</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Camiseta de Algodón Premium" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="md:col-span-4">
                <FormField<ProductFormValues>
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Categoría</FormLabel>
                            <div className="flex gap-2">
                                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                                    <FormControl>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={onAddCategory}
                                    title="Nueva Categoría"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-dashed mt-6">
                    <FormField<ProductFormValues>
                        control={form.control}
                        name="can_be_sold"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                        Puede ser vendido
                                    </FormLabel>
                                    <FormDescription className="text-[10px]">
                                        Habilitar para ventas y punto de venta.
                                    </FormDescription>
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

                    <FormField<ProductFormValues>
                        control={form.control}
                        name="can_be_purchased"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-amber-600" />
                                        Puede ser comprado
                                    </FormLabel>
                                    <FormDescription className="text-[10px]">
                                        Habilitar para compras y proveedores.
                                    </FormDescription>
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
        </div>
    )
}
