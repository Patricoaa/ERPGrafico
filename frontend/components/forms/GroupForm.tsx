import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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
import { Loader2 } from "lucide-react"

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
    const setOpen = isControlled ? setControlledOpen : setInternalOpen

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

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
                    <DialogDescription>
                        {initialData
                            ? "Modifica el nombre del grupo o equipo."
                            : "Crea un nuevo grupo funcional para asignar tareas."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="{FORM_STYLES.label}">Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Bodega, Ventas..." {...field} className="{FORM_STYLES.input} focus-visible:ring-primary" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

