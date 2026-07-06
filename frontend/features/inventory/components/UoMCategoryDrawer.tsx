"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Drawer, CancelButton, LabeledInput, FormFooter, ActionSlideButton } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ActivitySidebar } from "@/features/audit/components"
import { showApiError } from "@/lib/errors"
import { useUoMMutations } from "../hooks/useUoMMutations"
import { FormSplitLayout } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

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
    mode?: DrawerMode
}

export function UoMCategoryDrawer({ open: openProp, onOpenChange, initialData, onSuccess, mode: modeProp }: UoMCategoryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

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
                className="space-y-6 px-6 pb-6 pt-6"
            >
                <fieldset disabled={isView} className="contents">
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
                </fieldset>
            </form>
        </Form>
    )

    const identity = useDrawerIdentity('inventory.uomcategory', mode, initialData, {
        feminine: true,
        overrideSubtitle: initialData?.id ? "Modifique el nombre de la categoría y consulte el historial." : "Define un agrupador para unidades del mismo tipo.",
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="UoM Category"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={(mode === 'view' || mode === 'edit') && initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} disabled={isSaving} />
                                <ActionSlideButton type="submit" form="uom-category-form" loading={isSaving}>
                                    {mode === 'create' ? "Crear Categoría" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
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
        </>
    )
}
