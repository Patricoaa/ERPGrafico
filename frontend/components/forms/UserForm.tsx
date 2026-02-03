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
import { Loader2, Plus, User, ShieldCheck, ShieldAlert, Check } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    primary_role: z.string().min(1, "Debe seleccionar un rol principal"),
    functional_groups: z.array(z.string()),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
    is_active: z.boolean(),
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
    const [availableGroups, setAvailableGroups] = useState<any[]>([])
    const [contacts, setContacts] = useState<any[]>([])

    // Helper to parse groups from initialData
    const parseInitialGroups = () => {
        const groups = initialData?.groups || []
        const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']

        const primaryRole = groups.find((g: string) => systemRoles.includes(g)) || "OPERATOR"
        const functionalGroups = groups.filter((g: string) => !systemRoles.includes(g))

        return { primaryRole, functionalGroups }
    }

    const { primaryRole: initRole, functionalGroups: initGroups } = parseInitialGroups()

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: initialData?.username || "",
            primary_role: initRole,
            functional_groups: initGroups,
            contact: Number(initialData?.contact || 0),
            password: "",
            is_active: initialData?.is_active ?? true,
        }
    })

    useEffect(() => {
        if (open) {
            const fetchDisplayData = async () => {
                try {
                    const [rolesRes, groupsRes, contactsRes] = await Promise.all([
                        api.get('/core/users/roles/'),
                        api.get('/core/groups/'),
                        api.get('/contacts/')
                    ])

                    setAvailableRoles(rolesRes.data)

                    // Filter out system roles from the groups list so they don't appear in the "Teams" checklist
                    const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                    const functionalGroupsData = (groupsRes.data.results || groupsRes.data).filter(
                        (g: any) => !systemRoles.includes(g.name)
                    )
                    setAvailableGroups(functionalGroupsData)

                    setContacts(contactsRes.data.results || contactsRes.data)

                } catch (error) {
                    console.error("Error fetching form data", error)
                }
            }

            fetchDisplayData()

            const { primaryRole, functionalGroups } = parseInitialGroups()
            form.reset({
                username: initialData?.username || "",
                primary_role: primaryRole,
                functional_groups: functionalGroups,
                contact: Number(initialData?.contact || 0),
                password: "",
                is_active: initialData?.is_active ?? true,
            })
        }
    }, [open, initialData, form]) // Removed specific init props to avoid loops, relying on open + initialData

    async function onSubmit(data: UserFormValues) {
        setLoading(true)
        try {
            // Merge primary role and functional groups into the backend expected format
            const groups = [data.primary_role, ...data.functional_groups]

            const payload: any = {
                ...data,
                groups
            }

            // Cleanup generic form fields not in backend serializer
            delete payload.primary_role
            delete payload.functional_groups

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
                        </div>
                    ) : (
                        "Complete la información para crear el acceso al sistema"
                    )
                }
                size="xl"
                hideScrollArea={true}
                contentClassName="p-0"
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
                <div className="flex flex-col lg:flex-row h-full overflow-hidden min-h-[550px]">
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                                <Tabs defaultValue="general" className="flex-1 flex flex-col">
                                    <div className="px-6 border-b bg-muted/5">
                                        <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
                                            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                Información General
                                            </TabsTrigger>
                                            <TabsTrigger value="permissions" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4" />
                                                Permisos y Equipos
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="flex-1 p-6 lg:p-8">
                                        <TabsContent value="general" className="mt-0 space-y-6 outline-none">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="contact"
                                                    render={({ field }) => (
                                                        <FormItem className="md:col-span-2">
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contacto Vinculado</FormLabel>
                                                            <Select
                                                                onValueChange={(val) => field.onChange(parseInt(val))}
                                                                value={field.value?.toString()}
                                                                disabled={!!initialData}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="h-10 rounded-xl border-dashed bg-background">
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
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre de Usuario</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    {...field}
                                                                    disabled={!!initialData}
                                                                    placeholder="ej: pmartinez"
                                                                    className="h-10 rounded-xl border-dashed bg-background focus-visible:ring-primary"
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
                                                        <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-dashed p-4 bg-card/50">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem className="md:col-span-2">
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contraseña {initialData && "(opcional)"}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} type="password" placeholder="••••••••" className="h-10 rounded-xl border-dashed bg-background focus-visible:ring-primary" />
                                                            </FormControl>
                                                            {!initialData && <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres</p>}
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="permissions" className="mt-0 space-y-6 outline-none">
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-sm font-semibold mb-3">Permisos de Sistema (Rol)</h3>
                                                    <FormField
                                                        control={form.control}
                                                        name="primary_role"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    defaultValue={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-11">
                                                                            <SelectValue placeholder="Seleccione un rol de sistema" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {availableRoles.map(([val, label]) => (
                                                                            <SelectItem key={val} value={val}>
                                                                                {label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormDescription className="text-xs">
                                                                    Define los permisos técnicos de seguridad (Qué módulos puede ver).
                                                                </FormDescription>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <div className="border-t pt-6">
                                                    <h3 className="text-sm font-semibold mb-3">Equipos Funcionales</h3>
                                                    <p className="text-xs text-muted-foreground mb-4">
                                                        Asigne los equipos donde colabora este usuario. Esto define qué tareas recibirá.
                                                    </p>
                                                    <FormField
                                                        control={form.control}
                                                        name="functional_groups"
                                                        render={() => (
                                                            <FormItem>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {availableGroups.map((group) => (
                                                                        <FormField
                                                                            key={group.id}
                                                                            control={form.control}
                                                                            name="functional_groups"
                                                                            render={({ field }) => {
                                                                                return (
                                                                                    <FormItem
                                                                                        key={group.id}
                                                                                        className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md"
                                                                                    >
                                                                                        <FormControl>
                                                                                            <Checkbox
                                                                                                checked={field.value?.includes(group.name)}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    return checked
                                                                                                        ? field.onChange([...field.value, group.name])
                                                                                                        : field.onChange(
                                                                                                            field.value?.filter(
                                                                                                                (value) => value !== group.name
                                                                                                            )
                                                                                                        )
                                                                                                }}
                                                                                            />
                                                                                        </FormControl>
                                                                                        <FormLabel className="text-sm font-normal cursor-pointer w-full">
                                                                                            {group.name}
                                                                                        </FormLabel>
                                                                                    </FormItem>
                                                                                )
                                                                            }}
                                                                        />
                                                                    ))}

                                                                    {availableGroups.length === 0 && (
                                                                        <div className="col-span-2 text-center py-4 text-xs text-muted-foreground">
                                                                            No hay grupos funcionales creados. Vaya a "Grupos y Equipos" para crear uno.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </form>
                        </Form>
                    </div>

                    {/* Sidebar Area */}
                    {/* Sidebar Area */}
                    <div className="w-full lg:w-72 bg-muted/5 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden">
                        {initialData ? (
                            <ActivitySidebar entityId={initialData.id} entityType="user" />
                        ) : (
                            <div className="h-full p-8 flex items-center justify-center text-center bg-muted/10 rounded-xl border border-dashed m-6">
                                <p className="text-xs text-muted-foreground italic">
                                    El historial de actividad estará disponible una vez que se cree el usuario.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </BaseModal>
        </>
    )
}
