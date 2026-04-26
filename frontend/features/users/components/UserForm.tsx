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
import { CancelButton, SubmitButton, LabeledSeparator, LabeledInput, LabeledContainer, FormSection, FormTabs, FormTabsContent, type FormTabItem, FormSplitLayout, FormFooter, LabeledSelect, LabeledSwitch } from "@/components/shared"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AppGroup } from "@/types/entities"
import { cn } from "@/lib/utils"

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

    // Helper to map field errors to tabs
    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: boolean } = {}

        // General tab fields
        const generalFields: (keyof UserFormValues)[] = ['username', 'contact', 'password']
        generalFields.forEach(field => {
            if (errors[field]) tabErrors['general'] = true
        })

        // Permissions tab fields
        const permFields: (keyof UserFormValues)[] = ['primary_role', 'functional_groups']
        permFields.forEach(field => {
            if (errors[field]) tabErrors['permissions'] = true
        })

        return tabErrors
    }

    const tabErrors = getTabsWithErrors()

    const tabItems: FormTabItem[] = [
        {
            value: "general",
            label: "General",
            icon: User,
            hasErrors: tabErrors['general'],
        },
        {
            value: "permissions",
            label: "Permisos",
            icon: ShieldCheck,
            hasErrors: tabErrors['permissions'],
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
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} disabled={loading} />
                                <SubmitButton onClick={form.handleSubmit(onSubmit)} loading={loading}>
                                    {initialData ? "Guardar Cambios" : "Crear Usuario"}
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >                <FormSplitLayout
                    sidebar={auditSidebar}
                    showSidebar={!!initialData?.id}
                >
                    <Form {...form}>
                        <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                            <FormTabs
                                items={tabItems}
                                value={activeTab}
                                onValueChange={setActiveTab}
                                orientation="vertical"
                                header={headerSlot}
                                className="flex-1"
                            >
                                <div className="flex-1 p-6 lg:p-8 overflow-y-auto scrollbar-thin">
                                    <FormTabsContent value="general" className="mt-0 space-y-8 outline-none">
                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <FormSection title="Vinculación y Cuenta" icon={User} />
                                                <div className="grid grid-cols-4 gap-6">
                                                    <FormField
                                                        control={form.control}
                                                        name="contact"
                                                        render={({ field, fieldState }) => (
                                                            <div className="col-span-4">
                                                                <AdvancedContactSelector
                                                                    label="Contacto Vinculado"
                                                                    error={fieldState.error?.message}
                                                                    required
                                                                    value={field.value?.toString() || ""}
                                                                    onChange={(val) => field.onChange(val ? parseInt(val) : 0)}
                                                                    disabled={!!initialData}
                                                                />
                                                            </div>
                                                        )}
                                                    />

                                                    <div className="col-span-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="username"
                                                            render={({ field, fieldState }) => (
                                                                <LabeledInput
                                                                    label="Nombre de Usuario"
                                                                    required
                                                                    disabled={!!initialData}
                                                                    placeholder="ej: pmartinez"
                                                                    error={fieldState.error?.message}
                                                                    hint={initialData ? "Identificador único de sistema" : undefined}
                                                                    {...field}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <FormSection title="Seguridad y Acceso" icon={ShieldCheck} />
                                                <div className="grid grid-cols-4 gap-6">
                                                    <div className="col-span-2">
                                                        <FormField
                                                            control={form.control}
                                                            name="password"
                                                            render={({ field, fieldState }) => (
                                                                <LabeledInput
                                                                    label={`Contraseña Credencial${initialData ? " (Cambiar)" : ""}`}
                                                                    required={!initialData}
                                                                    type="password"
                                                                    placeholder="••••••••"
                                                                    hint={!initialData ? "Mínimo 6 caracteres" : "Dejar en blanco para mantener"}
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="col-span-2">
                                                        <FormField
                                                            control={form.control}
                                                            name="is_active"
                                                            render={({ field }) => (
                                                                <LabeledSwitch
                                                                    label="Estado del Acceso"
                                                                    description={field.value ? "ACTIVO" : "INACTIVO"}
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </FormTabsContent>

                                    <FormTabsContent value="permissions" className="mt-0 space-y-8 outline-none">
                                        <div className="space-y-8">
                                            <FormField
                                                control={form.control}
                                                name="primary_role"
                                                render={({ field, fieldState }) => (
                                                        <LabeledSelect 
                                                            label="Nivel de Permisos (Rol)" 
                                                            required 
                                                            error={fieldState.error?.message}
                                                            hint="Define la capacidad técnica global del usuario."
                                                            options={availableRoles.map(([val, label]) => ({ value: val, label }))}
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                        />
                                                )}
                                            />

                                            <div className="space-y-4">
                                                <FormSection title="Equipos Funcionales" icon={ShieldCheck} />
                                                
                                                <FormField
                                                    control={form.control}
                                                    name="functional_groups"
                                                    render={() => (
                                                        <FormItem>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {availableGroups.map((group) => (
                                                                    <FormField
                                                                        key={group.id}
                                                                        control={form.control}
                                                                        name="functional_groups"
                                                                        render={({ field }) => (
                                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-muted/5 rounded-xl border border-primary/5 hover:border-primary/20 hover:bg-muted/10 transition-all cursor-pointer group">
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
                                                                                <FormLabel className="text-[11px] font-black uppercase tracking-widest cursor-pointer w-full group-hover:text-primary transition-colors">
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
                </FormSplitLayout>
            </BaseModal>
        </>
    )
}
