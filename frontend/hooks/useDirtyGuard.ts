"use client"

import { useEffect, useRef } from "react"
import { useFormState, type FieldValues, type SubmitHandler, type UseFormReturn } from "react-hook-form"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"

type ValidHandler = SubmitHandler<FieldValues>

/**
 * Captura el último `onValid` que el drawer pasó a `form.handleSubmit(...)` para poder enviar el
 * formulario desde "Guardar y continuar" sin tocar cada drawer. `handleSubmit` se llama en el JSX,
 * después de este hook, así que el parche se instala en el primer render.
 *
 * Mientras `onValid` corre (`submitting`), el formulario cuenta como limpio: el drawer que se cierra al
 * guardar (`setOpen(false)` → `panel.close()` → `runGuarded`) no debe toparse con su propia guarda. Un
 * envío fallido no cierra, así que los cambios siguen protegidos.
 */
const submitters = new WeakMap<object, { onValid: ValidHandler | null; original: UseFormReturn<FieldValues>["handleSubmit"]; submitting: number }>()

function captureSubmitter<T extends FieldValues>(form: UseFormReturn<T>) {
    let slot = submitters.get(form)
    if (!slot) {
        const original = form.handleSubmit as unknown as UseFormReturn<FieldValues>["handleSubmit"]
        slot = { onValid: null, original, submitting: 0 }
        const captured = slot
        form.handleSubmit = ((onValid: ValidHandler, onInvalid?: Parameters<typeof original>[1]) => {
            const tracked: ValidHandler = async (data, event) => {
                captured.submitting++
                try { return await onValid(data, event) } finally { captured.submitting-- }
            }
            captured.onValid = tracked
            return original(tracked, onInvalid)
        }) as unknown as typeof form.handleSubmit
        submitters.set(form, slot)
    }
    return slot
}

/** Espera máxima a que el formulario refleje "limpio" tras un envío correcto. */
const SETTLE_MS = 400

interface UseDirtyGuardOptions<T extends FieldValues> {
    form: UseFormReturn<T>
    /** Solo se registra mientras el drawer está abierto. */
    open: boolean
    /** Nombre del documento para el diálogo. */
    name?: string
}

/**
 * Registra el formulario en la guarda de cambios sin guardar de GlobalModalProvider.
 * Sin provider (stories, tests aislados) no hace nada.
 */
export function useDirtyGuard<T extends FieldValues>({ form, open, name }: UseDirtyGuardOptions<T>): void {
    const modals = useOptionalGlobalModalActions()
    // RHF solo calcula `isDirty` si alguien lo lee en render; el valor vigente se espeja en una ref
    // para que el provider lo consulte desde un handler.
    const { isDirty } = useFormState({ control: form.control })
    const slot = captureSubmitter(form)

    const dirtyRef = useRef(isDirty)
    const mountedRef = useRef(false)
    const nameRef = useRef(name)

    useEffect(() => {
        dirtyRef.current = isDirty
        nameRef.current = name
    })

    const registerDirty = modals?.registerDirty
    useEffect(() => {
        if (!registerDirty || !open) return
        mountedRef.current = true
        const unregister = registerDirty({
            get name() { return nameRef.current },
            isDirty: () => dirtyRef.current && slot.submitting === 0,
            isSubmitting: () => slot.submitting > 0,
            discard: () => {
                // Limpia ya el espejo: otra guarda en la misma cadena (drawer + pila) no debe volver a preguntar.
                dirtyRef.current = false
                form.reset()
            },
            save: async () => {
                if (!slot.onValid) return false
                let invalid = false
                await slot.original(slot.onValid, () => { invalid = true })()
                if (invalid) return false
                // Guardado = el drawer se cerró (se retiró el registro) o el formulario volvió a quedar limpio.
                // React refleja el reset/cierre en un re-render posterior: se espera un instante.
                for (let waited = 0; waited < SETTLE_MS; waited += 20) {
                    if (!mountedRef.current || !dirtyRef.current) return true
                    await new Promise((resolve) => setTimeout(resolve, 20))
                }
                return !mountedRef.current || !dirtyRef.current
            },
        })
        return () => {
            mountedRef.current = false
            unregister()
        }
    }, [registerDirty, open, form, slot])
}
