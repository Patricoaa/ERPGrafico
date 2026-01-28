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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Loader2, Plus, User, ShieldCheck, ShieldAlert } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { Switch } from "@/components/ui/switch"

const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    groups_list: z.array(z.string()).min(1, "Debe seleccionar al menos un rol"),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
    is_active: z.boolean().default(true),
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
            is_active: initialData?.is_active ?? true,
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
                is_active: initialData?.is_active ?? true,
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
        <>
            {trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <span>Ficha de Usuario</span>
                    </div>
                }
                description={
                    initialData ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <span>{initialData.username}</span>
                            <span className="opacity-30">|</span>
                            <span>{initialData.groups_list?.[0] || "Sin Rol"}</span>
                        </div>
                    ) : (
                        "Complete la información para crear el acceso al sistema"
                    )
                }
                size="xl"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {initialData ? "Guardar Cambios" : "Crear Usuario"}
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col lg:flex-row h-full overflow-hidden min-h-[500px]">
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="contact"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Contacto Vinculado</FormLabel>
                                                <Select
                                                    onValueChange={(val) => field.onChange(parseInt(val))}
                                                    value={field.value?.toString()}
                                                    disabled={!!initialData}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="h-11">
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
                                                    <Input
                                                        {...field}
                                                        disabled={!!initialData}
                                                        placeholder="ej: pmartinez"
                                                        className="h-11"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="is_active"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/5">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="flex items-center gap-2">
                                                        {field.value ? <ShieldCheck className="h-4 w-4 text-green-500" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
                                                        Estado del Acceso
                                                    </FormLabel>
                                                    <FormDescription className="text-[10px]">
                                                        {field.value ? "Acceso al sistema permitido" : "Acceso revocado (Usuario inactivo)"}
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
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
                                                        <SelectTrigger className="h-11">
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
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Contraseña {initialData && "(opcional)"}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="password" placeholder="••••••••" className="h-11" />
                                                </FormControl>
                                                {!initialData && <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres</p>}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </form>
                        </Form>
                    </div>

                    {/* Sidebar Area */}
                    <div className="w-full lg:w-80 bg-muted/5 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4">
                            {initialData ? (
                                <ActivitySidebar entityId={initialData.id} entityType="user" />
                            ) : (
                                <div className="h-full flex items-center justify-center p-8 text-center bg-muted/10 rounded-xl border border-dashed">
                                    <p className="text-xs text-muted-foreground italic">
                                        El historial de actividad estará disponible una vez que se cree el usuario.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </BaseModal>
        </>
    )
}
