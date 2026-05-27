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
import { ActivitySidebar } from "@/features/audit/components"
import { Form, FormField } from "@/components/ui/form"
import { toast } from "sonner"
import { Users } from "lucide-react"
import { AppGroup } from "@/types/entities"
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
}

export function GroupDrawer({
    initialData,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen
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
            console.error(error)
            toast.error("Error al guardar el grupo")
        } finally {
            setIsLoading(false)
        }
    }

    const RenderTrigger = () => {
        if (isControlled) return null;
        if (!trigger) return null;

        if (React.isValidElement(trigger)) {
            return React.cloneElement(trigger as React.ReactElement, {
                // @ts-ignore
                onClick: (e: React.MouseEvent) => {
                    // @ts-ignore
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

    return (
        <>
            <RenderTrigger />
            <Drawer
                open={isOpen}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                title={
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Ficha de Grupo" : "Nuevo Grupo"}</span>
                    </div>
                }
                subtitle="Configuración de grupo funcional y permisos de acceso"
                footer={
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
                }
            >
                <FormSplitLayout
                    sidebar={initialData?.id ? (
                        <ActivitySidebar entityType="group" entityId={initialData.id} />
                    ) : undefined}
                    showSidebar={!!initialData?.id}
                >
                    <Form {...form}>
                        <form id="group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-4">
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
                                </div>
                            </div>
                        </form>
                    </Form>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}

