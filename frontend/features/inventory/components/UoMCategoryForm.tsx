"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, LabeledInput, FormFooter } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Ruler } from "lucide-react"
import { SubmitButton } from "@/components/shared/ActionButtons"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { showApiError } from "@/lib/errors"
import api from "@/lib/api"
import { toast } from "sonner"
import { FormSplitLayout } from "@/components/shared"

export interface UoMCategory {
    id: number
    name: string
}

const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface UoMCategoryFormProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Partial<UoMCategory>
    onSuccess?: (category?: UoMCategory) => void
}

export function UoMCategoryForm({ open: openProp, onOpenChange, initialData, onSuccess }: UoMCategoryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState
    const [isSaving, setIsSaving] = useState(false)

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: "",
        },
    })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            if (initialData && Object.keys(initialData).length > 0) {
                form.reset({
                    name: initialData.name || "",
                })
            } else {
                form.reset({
                    name: "",
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, form])

    async function onSubmit(data: CategoryFormValues) {
        setIsSaving(true)
        try {
            let res;
            if (initialData?.id) {
                res = await api.put(`/inventory/uom-categories/${initialData.id}/`, data)
                toast.success("Categoría actualizada")
            } else {
                res = await api.post('/inventory/uom-categories/', data)
                toast.success("Categoría creada")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(res.data)
        } catch (error: unknown) {
            console.error("Error saving Category:", error)
            showApiError(error, "Error al guardar la categoría")
        } finally {
            setIsSaving(false)
        }
    }

    const formContent = (
        <Form {...form}>
            <form 
                id="uom-category-form" 
                onSubmit={form.handleSubmit(onSubmit)} 
                className={initialData?.id ? "space-y-6 px-4 pb-4 pt-2" : "space-y-6"}
            >
                <div className="space-y-6">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Nombre"
                                required
                                placeholder="Ej: Peso, Volumen, Unidades"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                </div>
            </form>
        </Form>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={setOpen}
            size={initialData?.id ? "lg" : "sm"}
            hideScrollArea={!!initialData?.id}
            contentClassName={initialData?.id ? "p-0" : undefined}
            title={
                <div className="flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                    <span>{initialData?.id ? "Editar Categoría de Medida" : "Nueva Categoría de Medida"}</span>
                </div>
            }
            description={initialData?.id ? "Modifique el nombre de la categoría y consulte el historial." : "Define un agrupador para unidades del mismo tipo."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => setOpen(false)} disabled={isSaving} />
                            <SubmitButton form="uom-category-form" loading={isSaving}>
                                Guardar
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            {initialData?.id ? (
                <FormSplitLayout
                    sidebar={
                        <ActivitySidebar
                            entityId={initialData.id}
                            entityType="uom_category"
                        />
                    }
                    showSidebar={true}
                >
                    {formContent}
                </FormSplitLayout>
            ) : (
                formContent
            )}
        </BaseModal>
    )
}
