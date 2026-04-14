import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { BaseModal } from "@/components/shared/BaseModal"

// ... other imports same
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, Users } from "lucide-react"
import { FORM_STYLES } from "@/lib/styles"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
})

interface GroupFormProps {
    initialData?: any
    trigger?: React.ReactNode
    onSuccess?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function GroupForm({
    initialData,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: GroupFormProps) {
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

    useEffect(() => {
        if (isOpen) {
            form.reset({
                name: initialData?.name || "",
            })
        }
    }, [initialData, isOpen, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            if (initialData) {
                await api.patch(`/core/groups/${initialData.id}/`, values)
                toast.success("Grupo actualizado correctamente")
            } else {
                await api.post("/core/groups/", values)
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

    const Trigger = () => {
        if (isControlled) return null;
        if (!trigger) return null;
        return (
            <div onClick={() => setOpen?.(true)}>
                {trigger}
            </div>
        )
    }

    return (
        <>
            <Trigger />
            <BaseModal
                open={isOpen}
                onOpenChange={setOpen}
                size="sm"
                title={
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Ficha de Grupo" : "Nuevo Grupo"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span>Configuración de grupo funcional y permisos de acceso</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <ActionSlideButton type="submit" form="group-form" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </ActionSlideButton>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="group-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Bodega, Ventas..." {...field} className={FORM_STYLES.input} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}

