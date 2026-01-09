import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"

interface ProductInventorySwitchProps {
    form: UseFormReturn<ProductFormValues>
}

export function ProductInventorySwitch({ form }: ProductInventorySwitchProps) {
    const productType = form.watch("product_type")

    return (
        <FormField<ProductFormValues>
            control={form.control}
            name="track_inventory"
            render={({ field }) => (
                <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
                    <div className="flex flex-col gap-1">
                        <Label className="text-sm font-bold">¿Controlar Stock?</Label>
                        <span className="text-[10px] text-muted-foreground">Gestionar niveles de inventario</span>
                    </div>
                    <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={
                            productType === 'STORABLE' ||
                            productType === 'CONSUMABLE' ||
                            productType === 'SERVICE'
                        }
                    />
                </div>
            )}
        />
    )
}
