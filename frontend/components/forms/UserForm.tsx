"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"

const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    groups_list: z.array(z.string()).min(1, "Debe seleccionar al menos un rol"),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
})

type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
    initialData?: any
    onSuccess?: () => void
    trigger?: React.ReactNode
}

export function UserForm({ initialData, onSuccess, trigger }: UserFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<[string, string][]>([])
    const [contacts, setContacts] = useState<any[]>([])

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: initialData?.username || "",
            groups_list: initialData?.groups_list || ["OPERATOR"],
            contact: Number(initialData?.contact || 0),
            password: "",
        }
    })

    useEffect(() => {
        if (open) {
            const fetchRoles = async () => {
                try {
                    const res = await api.get('/core/users/roles/')
                    setAvailableRoles(res.data)
                } catch (error) {
                    console.error("Error fetching roles", error)
                }
            }
            const fetchContacts = async () => {
                try {
                    const res = await api.get('/contacts/')
                    setContacts(res.data.results || res.data)
                } catch (error) {
                    console.error("Error fetching contacts", error)
                }
            }
            fetchRoles()
            fetchContacts()

            form.reset({
                username: initialData?.username || "",
                groups_list: initialData?.groups_list || ["OPERATOR"],
                contact: Number(initialData?.contact || 0),
                password: "",
            })
        }
    }, [open, initialData, form])

    async function onSubmit(data: UserFormValues) {
        setLoading(true)
        try {
            const payload = { ...data }
            if (!payload.password) delete payload.password

            if (initialData?.id) {
                await api.patch(`/core/users/${initialData.id}/`, payload)
                toast.success("Usuario actualizado")
            } else {
                await api.post('/core/users/', payload)
                toast.success("Usuario creado")
            }
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Error al procesar usuario")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Usuario
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent size={initialData ? "md" : "xs"}>
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Usuario" : "Crear Usuario"}</DialogTitle>
                    <DialogDescription>
                        Seleccione un contacto y asigne las credenciales de acceso.
                    </DialogDescription>
                </DialogHeader>

                <div className={cn("grid gap-6", initialData ? "md:grid-cols-[1fr,280px]" : "grid-cols-1")}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="contact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contacto Vinculado</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(parseInt(val))}
                                            value={field.value?.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione la persona" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {contacts.map((contact) => (
                                                    <SelectItem key={contact.id} value={contact.id.toString()}>
                                                        {contact.name} ({contact.tax_id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre de Usuario (Para Login)</FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled={!!initialData} placeholder="ej: pmartinez" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="groups_list"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rol (Grupo)</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange([val])}
                                            defaultValue={field.value?.[0]}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione un rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {availableRoles.map(([val, label]) => (
                                                    <SelectItem key={val} value={val}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                                {availableRoles.length === 0 && (
                                                    <>
                                                        <SelectItem value="ADMIN">Administrador</SelectItem>
                                                        <SelectItem value="MANAGER">Gerente/Contador</SelectItem>
                                                        <SelectItem value="OPERATOR">Operador</SelectItem>
                                                        <SelectItem value="READ_ONLY">Lectura</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña {initialData && "(opcional)"}</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="password" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? "Actualizar" : "Crear"}
                                </Button>
                            </div>
                        </form>
                    </Form>

                    {initialData && (
                        <div className="border-l pl-6 hidden md:block">
                            <ActivitySidebar
                                entityId={initialData.id}
                                entityType="user"
                                className="h-[400px]"
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
