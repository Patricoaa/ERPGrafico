"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserInitialData } from "@/types/forms"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Loader2, Plus, User, ShieldCheck, ShieldAlert, Check, ChevronsUpDown, Search } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, SubmitButton, LabeledSeparator } from "@/components/shared"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { AppGroup } from "@/types/entities"

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
    auditSidebar?: React.ReactNode
    initialData?: UserInitialData
    onSuccess?: () => void
    trigger?: React.ReactNode
}

export function UserForm({ auditSidebar,  initialData, onSuccess, trigger }: UserFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<[string, string][]>([])
    const [availableGroups, setAvailableGroups] = useState<AppGroup[]>([])

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
                    const [rolesRes, groupsRes] = await Promise.all([
                        api.get('/core/users/roles/'),
                        api.get('/core/groups/')
                    ])

                    setAvailableRoles(rolesRes.data)

                    // Filter out system roles from the groups list so they don't appear in the "Teams" checklist
                    const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                    const functionalGroupsData = (groupsRes.data.results || groupsRes.data).filter(
                        (g: AppGroup) => !systemRoles.includes(g.name)
                    )
                    setAvailableGroups(functionalGroupsData)

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

            // Build typed payload — password is optional so we omit it if empty
            interface UserApiPayload {
                username: string
                groups: string[]
                contact: number
                is_active: boolean
                password?: string
            }

            const payload: UserApiPayload = {
                username: data.username,
                contact: data.contact,
                is_active: data.is_active,
                groups,
            }

            if (data.password) payload.password = data.password

            if (initialData?.id) {
                await api.patch(`/core/users/${initialData.id}/`, payload)
                toast.success("Usuario actualizado")
            } else {
                await api.post('/core/users/', payload)
                toast.success("Usuario creado")
            }
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            showApiError(error, "Error al procesar usuario")
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
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="font-bold tracking-tight">Ficha de Usuario</span>
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
                size={initialData ? "xl" : "lg"}
                hideScrollArea={true}
                contentClassName="p-0"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <CancelButton onClick={() => setOpen(false)} disabled={loading} className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5" />
                        <SubmitButton onClick={form.handleSubmit(onSubmit)} loading={loading} className="rounded-lg text-xs font-bold">
                            {initialData ? "Guardar Cambios" : "Crear Usuario"}
                        </SubmitButton>
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
                                                            <FormLabel className={FORM_STYLES.label}>Contacto Vinculado</FormLabel>
                                                            <AdvancedContactSelector
                                                                value={field.value?.toString() || ""}
                                                                onChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                                                                disabled={!!initialData}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="username"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>Nombre de Usuario</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    {...field}
                                                                    disabled={!!initialData}
                                                                    placeholder="ej: pmartinez"
                                                                    className={FORM_STYLES.input}
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
                                                        <FormItem className={cn("flex flex-row items-center justify-between rounded-lg p-4 bg-muted/5 border-none")}>
                                                            <div className="space-y-0.5">
                                                                <FormLabel className={cn("flex items-center gap-2", FORM_STYLES.label)}>
                                                                    {field.value ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
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
                                                                    className="data-[state=checked]:bg-success"
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
                                                            <FormLabel className={FORM_STYLES.label}>Contraseña {initialData && "(opcional)"}</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} type="password" placeholder="••••••••" className={FORM_STYLES.input} />
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
                                                {/* Permisos de Sistema */}
                                                <LabeledSeparator label="Permisos de Sistema (Rol)" />

                                                <FormField
                                                    control={form.control}
                                                    name="primary_role"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <FormControl>
                                                                        <Button
                                                                            variant="outline"
                                                                            role="combobox"
                                                                            className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground", FORM_STYLES.input)}
                                                                        >
                                                                            {field.value
                                                                                ? availableRoles.find(([val]) => val === field.value)?.[1]
                                                                                : "Seleccione un rol de sistema"}
                                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                        </Button>
                                                                    </FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                                    <div className="p-2">
                                                                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                            <input
                                                                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                                placeholder="Buscar rol..."
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value.toLowerCase()
                                                                                    const inputs = document.querySelectorAll('.role-item')
                                                                                    inputs.forEach((el) => {
                                                                                        if (el.textContent?.toLowerCase().includes(val)) {
                                                                                            (el as HTMLElement).style.display = 'flex'
                                                                                        } else {
                                                                                            (el as HTMLElement).style.display = 'none'
                                                                                        }
                                                                                    })
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                                            {availableRoles.map(([val, label]) => (
                                                                                <div
                                                                                    key={val}
                                                                                    className={cn(
                                                                                        "role-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                                        field.value === val && "bg-accent"
                                                                                    )}
                                                                                    onClick={() => {
                                                                                        field.onChange(val)
                                                                                        document.body.click()
                                                                                    }}
                                                                                >
                                                                                    <span>{label}</span>
                                                                                    {field.value === val && (
                                                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <FormDescription className="text-xs">
                                                                Define los permisos técnicos de seguridad.
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Equipos Funcionales */}
                                                <div className="pt-4">
                                                    <LabeledSeparator label="Equipos Funcionales" className="mb-3" />
                                                    <p className="text-[10px] text-muted-foreground mb-4 italic text-center">
                                                        Asigne los equipos donde colabora este usuario.
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
                                                                            render={({ field }) => (
                                                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-muted/5 rounded-lg border border-dashed hover:border-primary/30 transition-colors">
                                                                                    <FormControl>
                                                                                        <Checkbox
                                                                                            checked={field.value?.includes(group.name)}
                                                                                            onCheckedChange={(checked) => {
                                                                                                return checked
                                                                                                    ? field.onChange([...field.value, group.name])
                                                                                                    : field.onChange(field.value?.filter((v) => v !== group.name))
                                                                                            }}
                                                                                        />
                                                                                    </FormControl>
                                                                                    <FormLabel className="text-sm font-normal cursor-pointer w-full">
                                                                                        {group.name}
                                                                                    </FormLabel>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    ))}
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
                    {initialData?.id && (
                        <div className="w-full lg:w-72 bg-muted/5 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden hidden lg:flex">
                            {auditSidebar}
                        </div>
                    )}
                </div>
            </BaseModal>
        </>
    )
}

