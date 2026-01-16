import { FieldValues, UseFormProps, useForm, SubmitHandler, SubmitErrorHandler } from "react-hook-form"
import { showWarningToast } from "@/lib/utils/toast-utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

interface UseFormWithToastProps<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
    schema?: z.ZodType<T>
}

export function useFormWithToast<T extends FieldValues>({ schema, ...props }: UseFormWithToastProps<T>) {
    const form = useForm<T>({
        ...(schema && { resolver: zodResolver(schema as any) }),
        ...props
    } as any)

    const originalHandleSubmit = form.handleSubmit

    // Create a wrapped handleSubmit that adds automatic error toasts
    const wrappedHandleSubmit = (onValid: SubmitHandler<T>, onInvalid?: SubmitErrorHandler<T>) => {
        return originalHandleSubmit(onValid, (errors, e) => {
            // Call custom onInvalid if provided
            if (onInvalid) {
                onInvalid(errors, e)
            }

            // Automatic toast logic
            // We prioritize the checks requested: RUT and Name
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
    } as any
}
