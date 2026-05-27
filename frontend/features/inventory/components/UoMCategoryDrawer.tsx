"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Drawer, CancelButton, LabeledInput, FormFooter } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Ruler } from "lucide-react"
import { ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components"
import { showApiError } from "@/lib/errors"
import { useUoMMutations } from "../hooks/useUoMMutations"
import { FormSplitLayout } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"

export interface UoMCategory {
    id: number
    name: string
}

const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface UoMCategoryDrawerProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Partial<UoMCategory>
    onSuccess?: (category?: UoMCategory) => void
}

export function UoMCategoryDrawer({ open: openProp, onOpenChange, initialData, onSuccess }: UoMCategoryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState
    const { saveUoMCategory } = useUoMMutations()
    const [isSaving, setIsSaving] = useState(false)
    const width = formDrawerWidth("micro", !!initialData?.id)

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
            // saveUoMCategory invalida UOM_CATEGORIES_KEYS + UOMS_KEYS
            // (los UoMs muestran category_name derivado). Toast + markLocalMutation
            // a cargo del hook.
            const res = await saveUoMCategory({ id: initialData?.id ?? null, payload: data })
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(res)
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
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                contentClassName="p-0"
                icon={Ruler}
                title={initialData?.id ? "Editar Categoría de Medida" : "Nueva Categoría de Medida"}
                subtitle={initialData?.id ? "Modifique el nombre de la categoría y consulte el historial." : "Define un agrupador para unidades del mismo tipo."}
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} disabled={isSaving} />
                                <ActionSlideButton type="submit" form="uom-category-form" loading={isSaving}>
                                    Guardar
                                </ActionSlideButton>
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
        </Drawer>
    )
}
