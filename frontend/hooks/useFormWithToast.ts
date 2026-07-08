import { useMemo } from "react"
import { type FieldValues, type UseFormProps, useForm, type SubmitHandler, type SubmitErrorHandler, type UseFormReturn } from "react-hook-form"
import { showWarningToast } from "@/lib/utils/toast-utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { type z } from "zod"

interface UseFormWithToastProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
    schema?: z.ZodType<T, T>
}

export function useFormWithToast<T extends FieldValues>({ schema, ...props }: UseFormWithToastProps<T>) {
     
    const form = useForm<T>({
        ...(schema ? { resolver: zodResolver(schema as z.ZodType<T, T>) } : {}),
        ...props
    })

    const originalHandleSubmit = form.handleSubmit

    return useMemo(() => {
        // Create a wrapped handleSubmit that adds automatic error toasts
        const wrappedHandleSubmit = (onValid: SubmitHandler<T>, onInvalid?: SubmitErrorHandler<T>) => {
            return originalHandleSubmit(onValid, (errors, e) => {
                // Call custom onInvalid if provided
                if (onInvalid) {
                    onInvalid(errors, e)
                }

                // Automatic toast logic
                if (errors['tax_id']) {
                    showWarningToast("El RUT ingresado no es válido")
                } else if (errors['name']) {
                    showWarningToast("El Nombre es requerido")
                } else {
                    // Generic fallback for other errors
                    const firstErrorKey = Object.keys(errors)[0]
                    const firstError = errors[firstErrorKey]
                    if (firstError && firstError.message) {
                        showWarningToast(firstError.message as string)
                    }
                }
            })
        }

        return {
            ...form,
            handleSubmit: wrappedHandleSubmit
        } as unknown as UseFormReturn<T>
    }, [form, originalHandleSubmit])
}
