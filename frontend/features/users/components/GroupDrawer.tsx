import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { usersApi } from "../api/usersApi"

import {
    Drawer,
    ActionSlideButton,
    LabeledInput,
    CancelButton,
    FormFooter,
    FormSplitLayout,
} from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared"
import { type AppGroup } from "@/types/entities"
import { formDrawerWidth } from "@/lib/form-widths"

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
})

interface GroupDrawerProps {
    initialData?: AppGroup
    trigger?: React.ReactNode
    onSuccess?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    mode?: DrawerMode
}

function RenderTrigger({ trigger, isControlled, setOpen }: { trigger?: React.ReactNode, isControlled: boolean, setOpen: (val: boolean) => void }) {
    if (isControlled) return null;
    if (!trigger) return null;

    if (React.isValidElement(trigger)) {
        return React.cloneElement(trigger as React.ReactElement, {
            // @ts-expect-error injected onClick on a ReactElement with untyped props
            onClick: (e: React.MouseEvent) => {
                // @ts-expect-error trigger.props is unknown for a generic ReactElement
                if (trigger.props.onClick) trigger.props.onClick(e);
                setOpen(true);
            }
        });
    }

    return (
        <div onClick={() => setOpen?.(true)}>
            {trigger}
        </div>
    )
}

export function GroupDrawer({
    initialData,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    mode: modeProp
}: GroupDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const isControlled = controlledOpen !== undefined
    const isOpen = isControlled ? controlledOpen : internalOpen
    const setOpen = (val: boolean) => {
        if (isControlled) {
            setControlledOpen?.(val)
        } else {
            setInternalOpen(val)
        }
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
        },
    })

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const overrideTitle = mode === 'create' ? undefined
        : mode === 'view'
            ? (initialData?.name || 'Grupo')
            : `Editar: ${initialData?.name || ''}`
    const identity = useDrawerIdentity('settings.group', mode, initialData, {
        overrideTitle,
        overrideSubtitle: "Configuración de grupo funcional y permisos de acceso",
    })
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const width = formDrawerWidth("micro", !!initialData?.id)

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!isOpen) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            form.reset({
                name: initialData?.name || "",
            })
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [isOpen, initialData, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            if (initialData) {
                await usersApi.updateGroup(initialData.id, values)
                toast.success("Grupo actualizado correctamente")
            } else {
                await usersApi.createGroup(values)
                toast.success("Grupo creado correctamente")
            }
            setOpen?.(false)
            onSuccess?.()
        } catch (error) {
            showApiError(error, "Error al guardar el grupo")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <RenderTrigger trigger={trigger} isControlled={isControlled} setOpen={setOpen} />
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout ref={printRef} title="Ficha de Grupo" displayId={`#${initialData.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={isOpen}
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
                                <CancelButton onClick={() => setOpen(false)} disabled={isLoading} />
                                <ActionSlideButton type="submit" form="group-form" loading={isLoading}>
                                    Guardar
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <FormSplitLayout
                    sidebar={initialData?.id ? (
                        <ActivitySidebar entityType="group" entityId={initialData.id} />
                    ) : undefined}
                    showSidebar={!!initialData?.id}
                >
                    <Form {...form}>
                        <form id="group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Nombre del Grupo"
                                            required
                                            placeholder="Ej: Bodega, Ventas..."
                                            error={fieldState.error?.message}
                                            {...field}
                                        />
                                    )}
                                />
                            </fieldset>
                        </form>
                    </Form>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}

