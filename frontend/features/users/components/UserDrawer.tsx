"use client"

import * as React from "react"
import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { type UserInitialData } from "@/types/forms"
import { toast } from "sonner"
import { usersApi, type SodWarning } from "../api/usersApi"
import { useSingleUser } from "../hooks/useUserSearch"
import { Button } from "@/components/ui/button"
import { Form, FormField } from "@/components/ui/form"
import { Plus, User, ShieldCheck } from "lucide-react"
import { ActivitySidebar } from "@/features/audit"
import { Drawer, CancelButton, SubmitButton, LabeledInput, LabeledCheckboxGroup, FormSection, DrawerLayout, FormFooter, LabeledSwitch, SkeletonShell } from "@/components/shared"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { type AppGroup } from "@/types/entities"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { cn } from "@/lib/utils"
import { formDrawerWidth } from "@/lib/form-widths"
import { userSchema, type UserFormValues } from "../schema"

interface UserDrawerProps {
    initialData?: UserInitialData
    onSuccess?: () => void
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    mode?: DrawerMode
}

function extractGroupList(data: { results?: AppGroup[] } | AppGroup[]): AppGroup[] {
    if (Array.isArray(data)) return data
    return data.results ?? []
}

export function UserDrawer({ initialData, onSuccess, trigger, open: controlledOpen, onOpenChange: setControlledOpen, mode: modeProp }: UserDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? (setControlledOpen as (v: boolean) => void) : setInternalOpen
    const [loading, setLoading] = useState(false)
    const [isFetchingDeps, setIsFetchingDeps] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<AppGroup[]>([])
    const [availableTeams, setAvailableTeams] = useState<AppGroup[]>([])
    const [activeTab, setActiveTab] = useState("general")
    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const { printRef, handlePrint } = usePrintableDrawer()

    const userId = initialData?.id ?? null
    const { user: apiUser, loading: userLoading } = useSingleUser(userId)

    // Helper to parse groups from initialData or API data
    const parsedInitialValues = useMemo(() => {
        const source = apiUser ?? initialData ?? {}
        const rawGroups = (source as { groups?: unknown[] }).groups || []
        const roles: string[] = rawGroups
            .filter((g): g is AppGroup => typeof g === 'object' && g !== null && (g as AppGroup).kind === 'ROLE')
            .map((g) => (g as AppGroup).name)
        const teams: string[] = rawGroups
            .filter((g): g is AppGroup => typeof g === 'object' && g !== null && (g as AppGroup).kind === 'TEAM')
            .map((g) => (g as AppGroup).name)

        // Fallback for pre-loaded initialData without API kind field (API always returns kind now)
        const allGroupNames = rawGroups.map((g) => (typeof g === 'string' ? g : (g as AppGroup).name))
        const fallbackRoles = roles.length === 0 && allGroupNames.length > 0 ? allGroupNames : roles

        return {
            username: initialData?.username || apiUser?.username || "",
            roles: fallbackRoles,
            teams,
            contact: Number((source as { contact?: number }).contact || 0),
            password: "",
            is_active: (source as { is_active?: boolean }).is_active ?? true,
        }
    }, [apiUser, initialData])

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: parsedInitialValues
    })

    const width = formDrawerWidth("medium", !!initialData?.id)

    // Fetch roles (kind=ROLE) and teams (kind=TEAM) when drawer opens
    useEffect(() => {
        if (!open) return

        const fetchDisplayData = async () => {
            setIsFetchingDeps(true)
            try {
                const [rolesData, teamsData] = await Promise.all([
                    usersApi.getGroups({ kind: 'ROLE', limit: 50 }),
                    usersApi.getGroups({ kind: 'TEAM', limit: 50 }),
                ])

                setAvailableRoles(extractGroupList(rolesData))
                setAvailableTeams(extractGroupList(teamsData))
            } catch (error) {
                console.error("Error fetching group data", error)
            } finally {
                setIsFetchingDeps(false)
            }
        }

        void fetchDisplayData()
    }, [open])

    const isFetchingInitialData = open && (isFetchingDeps || userLoading)

    useInitializeDrawerForm({
        form,
        open: open && !userLoading,
        initialData: apiUser ?? initialData,
        getEntityId: () => initialData?.id,
        defaultValues: parsedInitialValues,
        mapData: () => parsedInitialValues,
    })

    async function onSubmit(data: UserFormValues) {
        setLoading(true)
        try {
            // Merge roles and teams into a flat groups list for the API
            const groups = [...data.roles, ...data.teams]

            const payload: Record<string, unknown> = {
                username: data.username,
                contact: data.contact,
                is_active: data.is_active,
                groups,
            }

            if (data.password) payload.password = data.password

            let result: { sod_warnings?: SodWarning[] } = {}

            if (initialData?.id) {
                result = await usersApi.updateUser(initialData.id, payload)
                toast.success("Usuario actualizado")
            } else {
                result = await usersApi.createUser(payload)
                toast.success("Usuario creado")
            }

            // Show non-blocking warning for SoD conflicts
            if (result.sod_warnings && result.sod_warnings.length > 0) {
                const labels = result.sod_warnings.map((w) => w.label).join(", ")
                toast.warning(`Conflictos de segregación detectados: ${labels}`, {
                    duration: 8000,
                })
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
        const permFields: (keyof UserFormValues)[] = ['roles', 'teams']
        permFields.forEach(field => {
            if (errors[field]) tabErrors['permissions'] = true
        })

        return tabErrors
    }

    const tabErrors = getTabsWithErrors()

    const identity = useDrawerIdentity('core.user', mode, initialData, {
        overrideSubtitle: "Gestión de cuentas, puestos y equipos.",
        printable: (mode === 'view' || mode === 'edit') && !!initialData?.id,
        onPrint: handlePrint,
    })

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
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Usuario:</span>
                            <span>{initialData?.username ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}

            <Drawer
                fillContent
                open={open}
                onOpenChange={setOpen}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                defaultSize={width}
                contentClassName="p-0 flex flex-col overflow-hidden bg-card"
                mode={mode}
                icon={identity.icon}
                side="left"
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} disabled={loading} />
                                <SubmitButton type="submit" onClick={form.handleSubmit(onSubmit)} loading={loading}>
                                    {initialData ? "Guardar Cambios" : "Crear Usuario"}
                                </SubmitButton>
                            </>
                        }
                    />
                )}
            >
                <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de usuario" className="flex-1 flex flex-col h-full">
                    <Form {...form}>
                        <form id="user-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 w-full h-full flex flex-col overflow-visible min-h-0">
                            <fieldset disabled={isView || loading} className="contents">
                                <DrawerLayout
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    rightRail={initialData?.id ? <ActivitySidebar entityId={initialData.id.toString()} entityType="user" /> : undefined}
                                    rightRailCollapsible
                                    rightRailStorageKey="erpgrafico.drawer.sidebar.user"
                                    tabs={[
                                        {
                                            value: "general",
                                            label: "General",
                                            icon: User,
                                            hasErrors: !!tabErrors['general'],
                                            className: "pt-6 px-6 pb-8",
                                            content: (
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
                                                                            icon={<ShieldCheck className="h-4 w-4 transition-colors" />}
                                                                            className="h-full"
                                                                            color="info"
                                                                        />
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            value: "permissions",
                                            label: "Permisos",
                                            icon: ShieldCheck,
                                            hasErrors: !!tabErrors['permissions'],
                                            className: "pt-6 px-6 pb-8 overflow-hidden",
                                            content: (
                                                <div className="flex flex-col flex-1 min-h-0 gap-8">
                                                    <div className="shrink-0">
                                                        <FormField
                                                            control={form.control}
                                                            name="roles"
                                                            render={({ field, fieldState }) => (
                                                                <LabeledCheckboxGroup
                                                                    columns={2}
                                                                    label="Puestos (Roles)"
                                                                    items={availableRoles.map((g) => ({ value: g.name, label: g.name }))}
                                                                    value={field.value || []}
                                                                    onChange={field.onChange}
                                                                    maxHeight="none"
                                                                    error={fieldState.error?.message}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                                                        <FormField
                                                            control={form.control}
                                                            name="teams"
                                                            render={({ field }) => (
                                                                <LabeledCheckboxGroup
                                                                    columns={2}
                                                                    label="Equipos"
                                                                    items={availableTeams.map((g) => ({ value: g.name, label: g.name }))}
                                                                    value={field.value || []}
                                                                    onChange={field.onChange}
                                                                    maxHeight="none"
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </fieldset>
                        </form>
                    </Form>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
