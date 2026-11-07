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
import { useBundles } from "../hooks/useRbac"
import { Button } from "@/components/ui/button"
import { Form, FormField } from "@/components/ui/form"
import { Plus, User, ShieldCheck, Users, AlertTriangle, Crown } from "lucide-react"
import { EntitySidebar } from "@/features/comments"
import {
    Drawer, CancelButton, SubmitButton, LabeledInput,
    DrawerLayout, FormFooter, LabeledSwitch, SkeletonShell, FormSection, FormSelectionGroup,
    type FormSelectionOption,
} from "@/components/shared"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { type AppGroup } from "@/types/entities"
import { type RbacBundle } from "../api/rbacApi"
import { useDrawerIdentity, useDrawerMode, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { useAuth } from "@/contexts/AuthContext"
import { userSchema, type UserFormValues } from "../schema"

// ---------------------------------------------------------------------------
// Module / level label maps (mirrors backend bundles.py)
// ---------------------------------------------------------------------------
const MODULE_LABELS: Record<string, string> = {
    billing: "Facturación",
    sales: "Ventas",
    purchasing: "Compras",
    accounting: "Contabilidad",
    treasury: "Tesorería",
    hr: "RR.HH.",
    production: "Producción",
    inventory: "Inventario",
    contacts: "Contactos",
    tax: "Tributario",
    workflow: "Workflow",
    core: "Sistema",
    finances: "Finanzas",
}

const LEVEL_ORDER = ["read", "operate", "manage"] as const
type LevelKey = (typeof LEVEL_ORDER)[number]

const LEVEL_LABELS: Record<LevelKey, string> = {
    read: "Lectura",
    operate: "Operador",
    manage: "Gestor",
}

interface ModuleAccess {
    app: string
    label: string
    /** Cumulative levels this role grants for this module (e.g. ["Lectura","Operador"]) */
    levels: string[]
    /** Labels of sensitive capability bundles from the same app (e.g. ["Nómina","Anticipos de Sueldo"]) */
    capabilities: string[]
}

interface ParsedRoleAccess {
    modules: ModuleAccess[]
}

function parseRoleAccess(bundleKeys: string[], bundleMeta: RbacBundle[]): ParsedRoleAccess {
    const metaByKey = new Map(bundleMeta.map((b) => [b.key, b]))
    const moduleMap = new Map<string, { highest: number; capabilities: string[] }>()

    const getEntry = (app: string) => {
        const existing = moduleMap.get(app)
        if (existing) return existing
        const created = { highest: -1, capabilities: [] as string[] }
        moduleMap.set(app, created)
        return created
    }

    for (const key of bundleKeys) {
        const parts = key.split(".")
        if (parts.length !== 2) continue
        const [app, level] = parts
        const idx = LEVEL_ORDER.indexOf(level as LevelKey)
        if (idx !== -1) {
            // Module-level bundle: track highest cumulative level
            const entry = getEntry(app)
            if (idx > entry.highest) entry.highest = idx
        } else {
            // Sensitive capability: group under its app module
            const entry = getEntry(app)
            const meta = metaByKey.get(key)
            entry.capabilities.push(meta?.label ?? key)
        }
    }

    const modules: ModuleAccess[] = Array.from(moduleMap.entries()).map(([app, data]) => ({
        app,
        label: MODULE_LABELS[app] ?? app,
        levels: data.highest >= 0
            ? LEVEL_ORDER.slice(0, data.highest + 1).map((l) => LEVEL_LABELS[l])
            : [],
        capabilities: data.capabilities,
    }))

    return { modules }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function UserDrawer({
    initialData,
    onSuccess,
    trigger,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    mode: modeProp,
}: UserDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? (setControlledOpen as (v: boolean) => void) : setInternalOpen
    const [loading, setLoading] = useState(false)
    const [isFetchingDeps, setIsFetchingDeps] = useState(false)
    const [availableRoles, setAvailableRoles] = useState<AppGroup[]>([])
    const [availableTeams, setAvailableTeams] = useState<AppGroup[]>([])
    const [activeTab, setActiveTab] = useState("general")
    const [pendingSuperuserGrant, setPendingSuperuserGrant] = useState(false)
    const { user: currentUser } = useAuth()
    const { mode, isView } = useDrawerMode({ mode: modeProp, initialData })
    const { printRef, handlePrint } = usePrintableDrawer()

    // Bundle metadata for role detail tooltips (cached 5 min)
    const { data: bundleMeta = [] } = useBundles()

    const userId = initialData?.id ?? null
    const { user: apiUser, loading: userLoading } = useSingleUser(userId)

    const parsedInitialValues = useMemo(() => {
        const source = apiUser ?? initialData ?? {}
        const rawGroups = (source as { groups?: unknown[] }).groups || []
        const roles: string[] = rawGroups
            .filter((g): g is AppGroup => typeof g === "object" && g !== null && (g as AppGroup).kind === "ROLE")
            .map((g) => (g as AppGroup).name)
        const teams: string[] = rawGroups
            .filter((g): g is AppGroup => typeof g === "object" && g !== null && (g as AppGroup).kind === "TEAM")
            .map((g) => (g as AppGroup).name)

        const allGroupNames = rawGroups.map((g) => (typeof g === "string" ? g : (g as AppGroup).name))
        const fallbackRoles = roles.length === 0 && allGroupNames.length > 0 ? allGroupNames : roles

        return {
            username: initialData?.username || apiUser?.username || "",
            roles: fallbackRoles,
            teams,
            contact: Number((source as { contact?: number }).contact || 0),
            password: "",
            is_active: (source as { is_active?: boolean }).is_active ?? true,
            is_superuser: (source as { is_superuser?: boolean }).is_superuser ?? false,
        }
    }, [apiUser, initialData])

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: parsedInitialValues,
    })

    useEffect(() => {
        if (!open) return
        const fetchDisplayData = async () => {
            setIsFetchingDeps(true)
            try {
                const [rolesData, teamsData] = await Promise.all([
                    usersApi.getGroups({ kind: "ROLE", limit: 100 }),
                    usersApi.getGroups({ kind: "TEAM", limit: 100 }),
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
        // Require explicit confirmation before granting superuser
        if (data.is_superuser && !parsedInitialValues.is_superuser && !pendingSuperuserGrant) {
            setPendingSuperuserGrant(true)
            return
        }
        setPendingSuperuserGrant(false)
        setLoading(true)
        try {
            const groups = [...data.roles, ...data.teams]
            const payload: Record<string, unknown> = {
                username: data.username,
                contact: data.contact,
                is_active: data.is_active,
                is_superuser: data.is_superuser,
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

            if (result.sod_warnings && result.sod_warnings.length > 0) {
                const labels = result.sod_warnings.map((w) => w.label).join(", ")
                toast.warning(`Conflictos de segregación detectados: ${labels}`, { duration: 8000 })
            }

            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            showApiError(error, "Error al procesar usuario")
        } finally {
            setLoading(false)
        }
    }

    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: boolean } = {}
        if (errors.username || errors.contact || errors.password) tabErrors["general"] = true
        if (errors.roles || errors.teams) tabErrors["roles"] = true
        return tabErrors
    }

    const tabErrors = getTabsWithErrors()
    const identity = useDrawerIdentity("core.user", mode, initialData, {
        overrideSubtitle: "Gestión de cuentas, roles y equipos.",
        printable: (mode === "view" || mode === "edit") && !!initialData?.id,
        onPrint: handlePrint,
    })

    const watchedRoles = form.watch("roles")
    const watchedTeams = form.watch("teams")
    const watchedIsSuperuser = form.watch("is_superuser")

    // Who can grant/revoke superuser: current superuser, or sysadmin (core.change_user)
    const canGrantSuperuser = currentUser?.is_superuser || currentUser?.permissions?.includes("core.change_user")
    // Self-escalation blocked for non-superusers
    const isSelf = currentUser?.id !== undefined && initialData?.id !== undefined && currentUser.id === initialData.id
    const superuserToggleDisabled = isView || !canGrantSuperuser || (!currentUser?.is_superuser && isSelf)

    return (
        <>
            {trigger ? (
                React.isValidElement(trigger) ? (
                    React.cloneElement(
                        trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
                        {
                            onClick: (e: React.MouseEvent) => {
                                const t = trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
                                if (t.props.onClick) t.props.onClick(e)
                                setOpen(true)
                            },
                        }
                    )
                ) : (
                    <div onClick={() => setOpen(true)}>{trigger}</div>
                )
            ) : !isControlled && (
                <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Usuario
                </Button>
            )}

            {(mode === "view" || mode === "edit") && initialData?.id && (
                <PrintableLayout ref={printRef} title="Ficha de Usuario" displayId={`#${initialData.id}`}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Usuario:</span>
                            <span>{initialData?.username ?? "-"}</span>
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
                defaultSize="100%"
                contentClassName="p-0"
                mode={mode}
                icon={identity.icon}
                side="left"
                footer={
                    isView ? undefined : (
                        <FormFooter
                            actions={
                                <>
                                    <CancelButton onClick={() => setOpen(false)} disabled={loading} />
                                    <SubmitButton
                                        type="submit"
                                        onClick={form.handleSubmit(onSubmit)}
                                        loading={loading}
                                    >
                                        {initialData ? "Guardar Cambios" : "Crear Usuario"}
                                    </SubmitButton>
                                </>
                            }
                        />
                    )
                }
            >
                <SkeletonShell
                    isLoading={isFetchingInitialData}
                    ariaLabel="Cargando formulario de usuario"
                    className="flex-1 flex flex-col h-full"
                >
                    <Form {...form}>
                        <form
                            id="user-form"
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="flex-1 w-full h-full flex flex-col overflow-visible min-h-0"
                        >
                                <DrawerLayout
                                    contentDisabled={isView || loading}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    rightRail={
                                        initialData?.id ? (
                                            <EntitySidebar
                                                entityId={initialData.id.toString()}
                                                entityType="user"
                                            />
                                        ) : undefined
                                    }
                                    rightRailCollapsible
                                    rightRailStorageKey="erpgrafico.drawer.sidebar.user"
                                    tabs={[
                                        {
                                            value: "general",
                                            label: "General",
                                            icon: User,
                                            hasErrors: !!tabErrors["general"],
                                            className: "pt-6 px-8 pb-8",
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
                                                                            onChange={(val) =>
                                                                                field.onChange(val ? parseInt(val) : 0)
                                                                            }
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
                                                                            hint={
                                                                                initialData
                                                                                    ? "Identificador único de sistema"
                                                                                    : undefined
                                                                            }
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
                                                                            label={`Contraseña${initialData ? " (Cambiar)" : ""}`}
                                                                            required={!initialData}
                                                                            type="password"
                                                                            placeholder="••••••••"
                                                                            hint={
                                                                                !initialData
                                                                                    ? "Mínimo 6 caracteres"
                                                                                    : "Dejar en blanco para mantener"
                                                                            }
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
                                            value: "roles",
                                            label: "Roles",
                                            icon: ShieldCheck,
                                            hasErrors: !!tabErrors["roles"],
                                            badge: watchedRoles?.length > 0 ? String(watchedRoles.length) : undefined,
                                            className: "pt-0 pb-0 overflow-hidden flex flex-col flex-1",
                                            content: (
                                                <RolesTab
                                                    form={form}
                                                    availableRoles={availableRoles}
                                                    bundleMeta={bundleMeta}
                                                    isLoading={isFetchingDeps}
                                                    disabled={isView || watchedIsSuperuser}
                                                    isSuperuser={watchedIsSuperuser}
                                                    canGrantSuperuser={canGrantSuperuser}
                                                    superuserToggleDisabled={superuserToggleDisabled}
                                                    isSelf={isSelf}
                                                    pendingSuperuserGrant={pendingSuperuserGrant}
                                                    onConfirmSuperuser={() => form.handleSubmit(onSubmit)()}
                                                    onCancelSuperuser={() => { setPendingSuperuserGrant(false); form.setValue("is_superuser", false) }}
                                                />
                                            ),
                                        },
                                        {
                                            value: "equipos",
                                            label: "Equipos",
                                            icon: Users,
                                            badge: watchedTeams?.length > 0 ? String(watchedTeams.length) : undefined,
                                            className: "pt-0 pb-0 overflow-hidden flex flex-col flex-1",
                                            content: (
                                                <TeamsTab
                                                    form={form}
                                                    availableTeams={availableTeams}
                                                    isLoading={isFetchingDeps}
                                                    disabled={isView}
                                                />
                                            ),
                                        },
                                    ]}
                                />
                        </form>
                    </Form>
                </SkeletonShell>
            </Drawer>
        </>
    )
}

// ---------------------------------------------------------------------------
// Roles tab
// ---------------------------------------------------------------------------

interface RolesTabProps {
    form: ReturnType<typeof useForm<UserFormValues>>
    availableRoles: AppGroup[]
    bundleMeta: RbacBundle[]
    isLoading: boolean
    disabled: boolean
    isSuperuser?: boolean
    canGrantSuperuser?: boolean
    superuserToggleDisabled?: boolean
    isSelf?: boolean
    pendingSuperuserGrant?: boolean
    onConfirmSuperuser?: () => void
    onCancelSuperuser?: () => void
}

function RolesTab({ form, availableRoles, bundleMeta, isLoading, disabled, isSuperuser, canGrantSuperuser, superuserToggleDisabled, isSelf, pendingSuperuserGrant, onConfirmSuperuser, onCancelSuperuser }: RolesTabProps) {
    const watchedRoles = form.watch("roles") ?? []
    const roleError = form.formState.errors.roles?.message
    const roleItems = useMemo(
        () => availableRoles.map((role) => roleSelectionOption(role, bundleMeta)),
        [availableRoles, bundleMeta],
    )

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Superuser toggle — top of tab, visible only to privileged editors */}
            {canGrantSuperuser && (
                <div className="shrink-0 px-8 pt-6 pb-4 border-b border-border/60">
                    <FormField
                        control={form.control}
                        name="is_superuser"
                        render={({ field }) => (
                            <LabeledSwitch
                                label="Superusuario"
                                description={
                                    superuserToggleDisabled && isSelf
                                        ? "No puede concederse este nivel a sí mismo"
                                        : field.value
                                        ? "Acceso total — omite todos los permisos"
                                        : "Sin acceso total"
                                }
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={superuserToggleDisabled}
                                icon={<Crown className="h-4 w-4 transition-colors" />}
                                color="warning"
                            />
                        )}
                    />
                    {/* Confirm banner */}
                    {pendingSuperuserGrant && (
                        <div className="flex items-start gap-3 mt-3 rounded-md border border-warning/40 bg-warning/8 px-4 py-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-foreground">¿Confirmar acceso total?</p>
                                <p className="text-xs text-muted-foreground">
                                    El usuario obtendrá acceso completo al sistema, omitiendo todos los controles de permisos. Esta acción queda registrada en el log de auditoría.
                                </p>
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={onConfirmSuperuser}
                                        className="rounded-sm bg-warning px-3 py-1 text-xs font-semibold text-warning-foreground hover:bg-warning/90">
                                        Confirmar
                                    </button>
                                    <button type="button" onClick={onCancelSuperuser}
                                        className="rounded-sm px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 px-8 pt-5 pb-4">
                <div className="space-y-0.5">
                    <h2 className="text-sm font-semibold text-foreground leading-snug">Roles de acceso</h2>
                    <p className="text-xs text-muted-foreground leading-snug">
                        Los roles definen qué puede ver, crear, modificar y aprobar el usuario en el sistema.
                        Cada rol agrupa permisos de uno o varios módulos.{" "}
                        {!isSuperuser && <strong className="font-medium text-foreground/70">Obligatorio — mínimo uno.</strong>}
                    </p>
                </div>
                {watchedRoles.length > 0 && !isSuperuser && (
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-2xs font-semibold text-primary tabular-nums">
                        {watchedRoles.length} activo{watchedRoles.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Superuser notice */}
            {isSuperuser && (
                <div className="shrink-0 flex items-center gap-2 mx-8 mb-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2.5">
                    <Crown className="h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-xs text-warning/90">Este usuario tiene acceso total. Los roles no aplican y no pueden modificarse.</p>
                </div>
            )}

            {/* Error banner */}
            {roleError && !isSuperuser && (
                <div className="shrink-0 flex items-center gap-2 mx-8 mt-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <p className="text-xs text-destructive">{roleError}</p>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto px-8 py-5 scrollbar-thin">
                <FormField
                    control={form.control}
                    name="roles"
                    render={({ field }) => {
                        if (isLoading) return <RoleListSkeleton />
                        if (availableRoles.length === 0) {
                            return (
                                <EmptyGroupState
                                    icon={ShieldCheck}
                                    message="No hay roles configurados. Crea roles en Configuración → Usuarios → Puestos."
                                />
                            )
                        }
                        return (
                            <FormSelectionGroup
                                mode="multiple"
                                label="Roles disponibles"
                                icon={<ShieldCheck className="h-4 w-4" />}
                                columns={3}
                                disabled={disabled}
                                value={field.value ?? []}
                                onChange={(values) => field.onChange(values.map(String))}
                                items={roleItems}
                            />
                        )
                    }}
                />
            </div>
        </div>
    )
}

function roleSelectionOption(role: AppGroup, bundleMeta: RbacBundle[]): FormSelectionOption {
    const access = parseRoleAccess(role.bundles ?? [], bundleMeta)
    const hasDetail = access.modules.length > 0 || !!role.description
    const tooltipLines = [role.description, ...access.modules.map((module) => {
        const levels = module.levels.join(" · ")
        const capabilities = module.capabilities.join(", ")
        const detail = [levels, capabilities].filter(Boolean).join("  +  ")
        return `${module.label}: ${detail}`
    })].filter(Boolean).join("\n\n")
    const moduleSummary = access.modules.map((module) => {
        const highestLevel = module.levels.at(-1)
        const capabilityCount = module.capabilities.length > 0 ? ` +${module.capabilities.length}` : ""
        return highestLevel ? `${module.label} (${highestLevel}${capabilityCount})` : module.label
    }).join(" · ")

    return {
        value: role.name,
        label: role.name,
        title: tooltipLines || undefined,
        eyebrow: "Rol de acceso",
        description: (
            <>
                <span className={moduleSummary ? "line-clamp-2" : "italic opacity-60"}>
                    {moduleSummary || role.description || "Sin módulos configurados"}
                </span>
                {hasDetail && <span className="sr-only">{tooltipLines}</span>}
            </>
        ),
    }
}

// ---------------------------------------------------------------------------
// Teams tab
// ---------------------------------------------------------------------------

interface TeamsTabProps {
    form: ReturnType<typeof useForm<UserFormValues>>
    availableTeams: AppGroup[]
    isLoading: boolean
    disabled: boolean
}

function TeamsTab({ form, availableTeams, isLoading, disabled }: TeamsTabProps) {
    const watchedTeams = form.watch("teams") ?? []
    const teamItems = useMemo(
        () => availableTeams.map(teamSelectionOption),
        [availableTeams],
    )

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 px-8 pt-6 pb-4">
                <div className="flex items-start gap-3">

                    <div className="space-y-0.5">
                        <h2 className="text-sm font-semibold text-foreground leading-snug">Equipos de trabajo</h2>
                        <p className="text-xs text-muted-foreground leading-snug">
                            Los equipos <strong className="font-medium text-foreground/70">no otorgan permisos</strong>.
                            Agrupan al usuario para recibir tareas asignadas, notificaciones y flujos de aprobación de
                            ese equipo. Opcional.
                        </p>
                    </div>
                </div>
                {watchedTeams.length > 0 && (
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-2xs font-semibold text-secondary-foreground tabular-nums">
                        {watchedTeams.length} equipo{watchedTeams.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-8 py-5 scrollbar-thin">
                <FormField
                    control={form.control}
                    name="teams"
                    render={({ field }) => {
                        if (isLoading) return <RoleListSkeleton count={4} />
                        if (availableTeams.length === 0) {
                            return (
                                <EmptyGroupState
                                    icon={Users}
                                    message="No hay equipos configurados. Crea equipos en Configuración → Usuarios → Equipos."
                                />
                            )
                        }
                        return (
                            <FormSelectionGroup
                                mode="multiple"
                                label="Equipos disponibles"
                                icon={<Users className="h-4 w-4" />}
                                columns={3}
                                disabled={disabled}
                                value={field.value ?? []}
                                onChange={(values) => field.onChange(values.map(String))}
                                items={teamItems}
                            />
                        )
                    }}
                />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function teamSelectionOption(team: AppGroup): FormSelectionOption {
    return {
        value: team.name,
        label: team.name,
        title: team.description,
        eyebrow: "Equipo de trabajo",
        description: team.description ? <span className="line-clamp-2">{team.description}</span> : undefined,
    }
}

function RoleListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="h-[88px] rounded-xl bg-muted/60 animate-pulse"
                    style={{ opacity: 1 - i * 0.12 }}
                />
            ))}
        </div>
    )
}

function EmptyGroupState({
    icon: Icon,
    message,
}: {
    icon: React.ElementType
    message: string
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">{message}</p>
        </div>
    )
}
