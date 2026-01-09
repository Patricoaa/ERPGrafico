import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"

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
            </div>
        </div>
    )
}
