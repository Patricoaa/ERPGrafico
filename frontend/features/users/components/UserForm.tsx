"use client"

import * as React from "react"
import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserInitialData } from "@/types/forms"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Plus, User, ShieldCheck, ShieldAlert } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, SubmitButton, LabeledSeparator, LabeledInput, LabeledContainer, FormTabs, FormTabsContent, type FormTabItem } from "@/components/shared"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
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

export function UserForm({ auditSidebar, initialData, onSuccess, trigger }: UserFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<[string, string][]>([])
    const [availableGroups, setAvailableGroups] = useState<AppGroup[]>([])
    const [activeTab, setActiveTab] = useState("general")

    // Helper to parse groups from initialData
    const parsedInitialValues = useMemo(() => {
        const groups = initialData?.groups || []
        const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']

        const primaryRole = groups.find((g: string) => systemRoles.includes(g)) || "OPERATOR"
        const functionalGroups = groups.filter((g: string) => !systemRoles.includes(g))

        return {
            username: initialData?.username || "",
            primary_role: primaryRole,
            functional_groups: functionalGroups,
            contact: Number(initialData?.contact || 0),
            password: "",
            is_active: initialData?.is_active ?? true,
        }
    }, [initialData])

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: parsedInitialValues
    })

    // Fetch static data once when opened
    useEffect(() => {
        if (!open) return

        const fetchDisplayData = async () => {
            try {
                const [rolesRes, groupsRes] = await Promise.all([
                    api.get('/core/users/roles/'),
                    api.get('/core/groups/')
                ])

                setAvailableRoles(rolesRes.data)

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
    }, [open])

    // Sync form values with initialData when modal opens or initialData changes
    const lastResetId = useRef<string | number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        const shouldReset = (open && !wasOpen.current) || (open && initialData?.id !== lastResetId.current)
        
        if (shouldReset) {
            form.reset(parsedInitialValues)
            lastResetId.current = initialData?.id
        }
        
        wasOpen.current = open
    }, [open, initialData?.id, form, parsedInitialValues])

    async function onSubmit(data: UserFormValues) {
        setLoading(true)
        try {
            const groups = [data.primary_role, ...data.functional_groups]

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

    const tabItems: FormTabItem[] = [
        {
            value: "general",
            label: "General",
            icon: User,
        },
        {
            value: "permissions",
            label: "Permisos",
            icon: ShieldCheck,
        },
    ]

    const headerSlot = (
        <div className="px-6 py-4 border-b bg-muted/5">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold tracking-tight text-foreground text-sm uppercase">Ficha de Usuario</h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {initialData ? initialData.username : "Nuevo acceso al sistema"}
                    </p>
                </div>
            </div>
        </div>
    )

    return (
        <>
            {trigger ? (
                React.isValidElement(trigger) ? (
                    React.cloneElement(trigger as React.ReactElement, {
                        // @ts-ignore
                        onClick: (e: React.MouseEvent) => {
                            // @ts-ignore
                            if (trigger.props.onClick) trigger.props.onClick(e);
                            setOpen(true);
                        }
                    })
                ) : (
                    <div onClick={() => setOpen(true)}>{trigger}</div>
                )
            ) : (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                headerClassName="sr-only"
                title="Ficha de Usuario"
                size={initialData ? "xl" : "lg"}
                hideScrollArea={true}
                allowOverflow={true}
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
                <div className="flex flex-col lg:flex-row h-full overflow-visible min-h-[550px]">
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-visible">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                                <FormTabs
                                    items={tabItems}
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    orientation="vertical"
                                    header={headerSlot}
                                    className="flex-1"
                                >
                                    <div className="flex-1 p-6 lg:p-8 overflow-y-auto scrollbar-thin max-h-[70vh]">
                                        <FormTabsContent value="general" className="mt-0 space-y-6 outline-none">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="contact"
                                                    render={({ field, fieldState }) => (
                                                        <div className="md:col-span-2">
                                                            <LabeledContainer
                                                                label="Contacto Vinculado"
                                                                error={fieldState.error?.message}
                                                                required
                                                            >
                                                                <AdvancedContactSelector
                                                                    value={field.value?.toString() || ""}
                                                                    onChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                                                                    disabled={!!initialData}
                                                                    className="border-0 focus-visible:ring-0 h-8 shadow-none"
                                                                />
                                                            </LabeledContainer>
                                                        </div>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="username"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Nombre de Usuario"
                                                                    required
                                                                    disabled={!!initialData}
                                                                    placeholder="ej: pmartinez"
                                                                    error={fieldState.error?.message}
                                                                    hint={initialData ? "El nombre de usuario no puede modificarse" : undefined}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="is_active"
                                                    render={({ field }) => (
                                                        <LabeledContainer
                                                            label="Estado del Acceso"
                                                            icon={field.value ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
                                                            hint={field.value ? "Acceso al sistema permitido" : "Acceso revocado (Usuario inactivo)"}
                                                        >
                                                            <div className="flex items-center justify-between w-full pr-4">
                                                                <span className="text-xs font-medium text-muted-foreground">Acceso Habilitado</span>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    className="data-[state=checked]:bg-success scale-75"
                                                                />
                                                            </div>
                                                        </LabeledContainer>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="password"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="md:col-span-2">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label={`Contraseña${initialData ? " (opcional)" : ""}`}
                                                                    required={!initialData}
                                                                    type="password"
                                                                    placeholder="••••••••"
                                                                    hint={!initialData ? "Mínimo 6 caracteres" : undefined}
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </FormTabsContent>

                                        <FormTabsContent value="permissions" className="mt-0 space-y-6 outline-none">
                                            <div className="space-y-6">
                                                <LabeledSeparator label="Permisos de Sistema (Rol)" />

                                                <FormField
                                                    control={form.control}
                                                    name="primary_role"
                                                    render={({ field, fieldState }) => (
                                                        <LabeledContainer 
                                                            label="Permisos de Sistema (Rol)" 
                                                            required 
                                                            error={fieldState.error?.message}
                                                            hint="Define los permisos técnicos de seguridad."
                                                        >
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <SelectTrigger className="border-0 focus:ring-0 h-8 px-2 shadow-none">
                                                                    <SelectValue placeholder="Seleccione un rol..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {availableRoles.map(([val, label]) => (
                                                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </LabeledContainer>
                                                    )}
                                                />

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
                                        </FormTabsContent>
                                    </div>
                                </FormTabs>
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
