import { FormField } from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { FORM_STYLES } from "@/lib/styles"

interface ProductTypeSelectorProps {
    form: UseFormReturn<ProductFormValues>
    disabled?: boolean
}

export function ProductTypeSelector({ form, disabled, lockedType }: ProductTypeSelectorProps & { lockedType?: string }) {
    return (
        <FormField<ProductFormValues>
            control={form.control}
            name="product_type"
            render={({ field, fieldState }) => (
                <div className="space-y-4">

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
                                const isDisabled = !!(disabled || isLocked);

                                return (
                                    <div key={t.id} className={`flex items-center space-x-3 space-y-0 py-2 transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/30 rounded-md px-2 -mx-2'}`}>
                                        <RadioGroupItem value={t.id} disabled={isDisabled} />
                                        <label className={`font-medium flex-1 text-sm ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                            {t.label}
                                        </label>
                                    </div>
                                )
                            })}
                        </RadioGroup>
                    {fieldState.error && <p className="text-[10px] text-destructive">{fieldState.error.message}</p>}
                </div>
            )}
        />
    )
}
