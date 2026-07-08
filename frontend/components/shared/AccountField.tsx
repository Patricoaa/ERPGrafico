"use client"

import { FormField } from "@/components/ui/form"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import type { UseFormReturn, Path, FieldValues } from "react-hook-form"

interface AccountFieldProps<TFormValues extends FieldValues> {
    form: UseFormReturn<TFormValues>
    name: Path<TFormValues>
    label: string
    accountType: string | string[]
}

export function AccountField<TFormValues extends FieldValues>({
    form, name, label, accountType
}: AccountFieldProps<TFormValues>) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <AccountSelector
                    label={label}
                    value={field.value as string}
                    onChange={(val) => field.onChange(val)}
                    accountType={accountType}
                    error={fieldState.error?.message}
                />
            )}
        />
    )
}
