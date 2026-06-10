"use client"

import * as React from "react"
import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserInitialData } from "@/types/forms"
import * as z from "zod"
import { toast } from "sonner"
import { usersApi } from "../api/usersApi"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Plus, User, ShieldCheck, Printer } from "lucide-react"
import { Drawer, CancelButton, ActionSlideButton, LabeledInput, FormSection, FormTabs, FormTabsContent, type FormTabItem, FormSplitLayout, FormFooter, LabeledSelect, LabeledSwitch, EntityHeader, SkeletonShell } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AppGroup } from "@/types/entities"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { cn } from "@/lib/utils"
import { formDrawerWidth } from "@/lib/form-widths"

const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    primary_role: z.string().min(1, "Debe seleccionar un rol principal"),
    functional_groups: z.array(z.string()),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
    is_active: z.boolean(),
})

type UserFormValues = z.infer<typeof userSchema>

interface UserDrawerProps {
    auditSidebar?: React.ReactNode
    initialData?: UserInitialData
    onSuccess?: () => void
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    mode?: DrawerMode
}

export function UserDrawer({ auditSidebar, initialData, onSuccess, trigger, open: controlledOpen, onOpenChange: setControlledOpen, mode: modeProp }: UserDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen
    const [loading, setLoading] = useState(false)
    const [isFetchingDeps, setIsFetchingDeps] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<[string, string][]>([])
    const [availableGroups, setAvailableGroups] = useState<AppGroup[]>([])
    const [activeTab, setActiveTab] = useState("general")
    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    // Helper to parse groups from initialData
    const parsedInitialValues = useMemo(() => {
        const rawGroups = initialData?.groups || []
        const groups: string[] = rawGroups.map((g) => (typeof g === 'string' ? g : g.name))
        const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']

        const primaryRole = groups.find((g) => systemRoles.includes(g)) || "OPERATOR"
        const functionalGroups = groups.filter((g) => !systemRoles.includes(g))

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

    const width = formDrawerWidth("master", !!initialData?.id)

    // Fetch static data once when opened
    useEffect(() => {
        if (!open) return

        const fetchDisplayData = async () => {
            setIsFetchingDeps(true)
            try {
                const [rolesData, groupsData] = await Promise.all([
                    usersApi.getRoles(),
                    usersApi.getGroups()
                ])

                setAvailableRoles(rolesData)

                const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const functionalGroupsData = (groupsData.results || groupsData).filter(
                    (g: AppGroup) => !systemRoles.includes(g.name)
                )
                setAvailableGroups(functionalGroupsData)
            } catch (error) {
                console.error("Error fetching form data", error)
            } finally {
                setIsFetchingDeps(false)
            }
        }

        fetchDisplayData()
    }, [open])

    const isFetchingInitialData = open && isFetchingDeps

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
                await usersApi.updateUser(initialData.id, payload)
                toast.success("Usuario actualizado")
            } else {
                await usersApi.createUser(payload)
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
        <EntityHeader
            entityLabel="core.user"
            data={initialData}
            action={initialData ? 'edit' : 'create'}
            className="border-none px-6 py-4 bg-muted/5 print:hidden"
        />
    )

    const drawerTitle = isView
        ? `Ficha de Usuario${initialData?.id ? ` #${initialData.id}` : ""}`
        : mode === 'create'
            ? "Nuevo Usuario"
            : "Editar Usuario"

    return (
        <>
            {trigger ? (
                React.isValidElement(trigger) ? (
                    React.cloneElement(trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
                        onClick: (e: React.MouseEvent) => {
                            const triggerEl = trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
                            if (triggerEl.props.onClick) triggerEl.props.onClick(e);
                            setOpen(true);
                        }
                    })
                ) : (
                    <div onClick={() => setOpen(true)}>{trigger}</div>
                )
            ) : !isControlled && (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            )}

            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout ref={printRef} title="Ficha de Usuario" displayId={`#${initialData.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Usuario:</span>
                            <span>{initialData?.username ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}

            <Drawer
                open={open}
                onOpenChange={setOpen}
                headerClassName="sr-only"
                title={<><span>{drawerTitle}</span>{(mode === 'view' || mode === 'edit') && initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}</>}
                subtitle="Gestión de cuentas, roles y permisos de acceso."
                defaultSize={width}
                mode={mode}
                side="left"
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} disabled={loading} />
                                <ActionSlideButton type="submit" onClick={form.handleSubmit(onSubmit)} loading={loading}>
                                    {initialData ? "Guardar Cambios" : "Crear Usuario"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de usuario" className="flex-1 flex flex-col">
                    <Form {...form}>
                        <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
                                <FormTabs
                                    items={tabItems}
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    orientation="horizontal"
                                    variant="underline"
                                    header={headerSlot}
                                    contentClassName="bg-transparent"
                                    className="flex-1"
                                >
                                    <fieldset disabled={loading} className="flex-1 min-w-0 flex flex-col h-full min-h-0">
                                        <FormTabsContent value="general" className="mt-0 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-hidden outline-none">
                                            <FormSplitLayout sidebar={auditSidebar} showSidebar={!!initialData?.id} className="p-0">
                                                <div className="p-6 lg:p-8 space-y-8 overflow-y-auto scrollbar-thin h-full">
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
                                                                                icon={<ShieldCheck className={cn("h-4 w-4 transition-colors", field.value ? "text-success" : "text-muted-foreground/30")} />}
                                                                                className={cn(field.value ? "bg-success/5 border-success/20 shadow-sm" : "border-dashed")}
                                                                            />
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </FormSplitLayout>
                                        </FormTabsContent>
                                        <FormTabsContent value="permissions" className="mt-0 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-hidden outline-none">
                                            <FormSplitLayout sidebar={auditSidebar} showSidebar={!!initialData?.id} className="p-0">
                                                <div className="p-6 lg:p-8 space-y-8 overflow-y-auto scrollbar-thin h-full">
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
                                                </div>
                                            </FormSplitLayout>
                                        </FormTabsContent>
                                    </fieldset>
                                </FormTabs>
                            </fieldset>
                        </form>
                    </Form>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
