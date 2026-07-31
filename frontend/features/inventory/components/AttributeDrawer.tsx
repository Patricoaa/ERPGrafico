"use client"

import { showApiError } from "@/lib/errors"
import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Drawer, CancelButton, FormFooter, FormSplitLayout } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { useAttributes, type Attribute } from "@/features/inventory/hooks/useAttributes"
import { useSuggestions } from "@/hooks/useSuggestions"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared"
import { MultiTagInput } from "@/components/shared"
import { Tag } from "lucide-react"

const attributeSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
})

type AttributeFormValues = z.infer<typeof attributeSchema>

interface AttributeDrawerProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Partial<Attribute>
    onSuccess?: () => void
    mode?: DrawerMode
}

export function AttributeDrawer({ open: openProp, onOpenChange, initialData, onSuccess, mode: modeProp }: AttributeDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'

    const { saveAttribute, createAttributeValue, isSaving } = useAttributes()

    const [attrValues, setAttrValues] = useState<string[]>([])

    const form = useForm<AttributeFormValues>({
        resolver: zodResolver(attributeSchema) as unknown as Resolver<AttributeFormValues>,
        defaultValues: {
            name: "",
        },
    })

    const [valueInput, setValueInput] = useState("")
    const { suggestions, isLoading: isLoadingSuggestions } = useSuggestions(
        "/inventory/attribute-values/filter-suggestions/",
        valueInput
    )

    const width = formDrawerWidth("simple", !!initialData?.id)

    const [lastResetId, setLastResetId] = useState<number | undefined>(undefined)
    const [wasOpen, setWasOpen] = useState(false)

    if (open) {
        const currentId = initialData?.id
        const isNewOpen = !wasOpen
        const isNewData = currentId !== lastResetId

        if (isNewOpen || isNewData) {
            setWasOpen(true)
            setLastResetId(currentId)
            if (initialData && Object.keys(initialData).length > 0) {
                form.reset({ name: initialData.name || "" })
                setAttrValues(initialData.values?.map((v) => v.value) ?? [])
            } else {
                form.reset({ name: "" })
                setAttrValues([])
            }
        }
    } else if (wasOpen) {
        setWasOpen(false)
    }

    async function onSubmit(data: AttributeFormValues) {
        try {
            const saved = await saveAttribute({
                id: initialData?.id ?? null,
                payload: { name: data.name },
            })

            if (attrValues.length > 0) {
                const existingNames = new Set(
                    (initialData?.values ?? []).map((v) => v.value)
                )
                const newValues = attrValues.filter((v) => !existingNames.has(v))
                if (newValues.length > 0) {
                    await Promise.all(
                        newValues.map((val) =>
                            createAttributeValue({ attribute: saved.id, value: val })
                        )
                    )
                }
            }

            form.reset()
            setAttrValues([])
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            showApiError(error, "Error al guardar el atributo")
        }
    }

    const identity = useDrawerIdentity('inventory.attribute', mode, initialData, {
        overrideSubtitle: initialData?.id
            ? "Modifique el nombre o gestione los valores del atributo."
            : "Defina un nuevo atributo para generar variaciones de producto.",
    })

    return (
        <Drawer
            fillContent
            open={open}
            onOpenChange={setOpen}
            side="left"
            defaultSize={width}
            mode={mode}
            icon={identity.icon}
            title={identity.title}
            headerActions={identity.headerActions}
            subtitle={identity.subtitle}
            footer={isView ? undefined : (
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => setOpen(false)} disabled={isSaving} />
                            <ActionSlideButton type="submit" form="attribute-form" loading={isSaving}>
                                {mode === 'create' ? "Crear Atributo" : "Guardar Cambios"}
                            </ActionSlideButton>
                        </>
                    }
                />
            )}
        >
            <FormSplitLayout
                sidebar={initialData?.id ? (
                    <ActivitySidebar
                        entityId={initialData.id}
                        entityType="attribute"
                    />
                ) : undefined}
                showSidebar={!!initialData?.id}
            >
                <Form {...form}>
                    <form
                        id="attribute-form"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6 px-6 pb-6 pt-6"
                    >
                        <fieldset disabled={isView} className="contents">
                            <div className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground px-1">
                                                Nombre del Atributo
                                                <span className="text-destructive ml-0.5">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full h-9 px-3 rounded-md border bg-transparent text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                                placeholder="Ej: Color, Talla"
                                                {...field}
                                            />
                                            {fieldState.error && (
                                                <p className="text-[10px] font-medium text-destructive pl-1">
                                                    {fieldState.error.message}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                />

                                <MultiTagInput
                                    label="Valores del Atributo"
                                    placeholder="Escribe un valor y pulsa Enter..."
                                    values={attrValues}
                                    onAdd={(v) => setAttrValues([...attrValues, v])}
                                    onRemove={(v) => setAttrValues(attrValues.filter((t) => t !== v))}
                                    suggestions={suggestions}
                                    isLoadingSuggestions={isLoadingSuggestions}
                                    hint="Define los valores posibles (ej: Rojo, Azul, Verde). Puedes escribir nuevos o seleccionar de los existentes."
                                />
                            </div>
                        </fieldset>
                    </form>
                </Form>
            </FormSplitLayout>
        </Drawer>
    )
}
