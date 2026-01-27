import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"

interface ProductTypeSelectorProps {
    form: UseFormReturn<ProductFormValues>
    disabled?: boolean
}

export function ProductTypeSelector({ form, disabled, lockedType }: ProductTypeSelectorProps & { lockedType?: string }) {
    return (
        <FormField<ProductFormValues>
            control={form.control}
            name="product_type"
            render={({ field }) => (
                <FormItem className="space-y-4">
                    <FormLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tipo de Producto</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={(val) => {
                                field.onChange(val);
                                // Storable usually wants inventory, others don't by default
                                if (val === 'STORABLE') {
                                    form.setValue('track_inventory', true);
                                } else {
                                    form.setValue('track_inventory', false);
                                }
                            }}
                            value={field.value}
                            className="flex flex-col space-y-2"
                        >
                            {[
                                { id: 'STORABLE', label: 'Almacenable' },
                                { id: 'CONSUMABLE', label: 'Consumible' },
                                { id: 'MANUFACTURABLE', label: 'Fabricable' },
                                { id: 'SERVICE', label: 'Servicio (Único)' },
                                { id: 'SUBSCRIPTION', label: 'Suscripción (Recurrente)' }
                            ].map((t) => {
                                const isLocked = lockedType && lockedType !== t.id;
                                const isDisabled = disabled || isLocked;

                                return (
                                    <FormItem key={t.id} className={`flex items-center space-x-3 space-y-0 p-3 rounded-xl border hover:bg-muted/50 transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <FormControl>
                                            <RadioGroupItem value={t.id} disabled={isDisabled} />
                                        </FormControl>
                                        <FormLabel className={`font-medium flex-1 text-sm ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                            {t.label}
                                        </FormLabel>
                                    </FormItem>
                                )
                            })}
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
