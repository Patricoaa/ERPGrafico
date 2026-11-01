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
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Form, FormField } from "@/components/ui/form"
import { Plus, User, ShieldCheck, Users, Info, AlertTriangle } from "lucide-react"
import { ActivitySidebar } from "@/features/audit"
import {
    Drawer, CancelButton, SubmitButton, LabeledInput,
    DrawerLayout, FormFooter, LabeledSwitch, SkeletonShell, FormSection,
} from "@/components/shared"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { type AppGroup } from "@/types/entities"
import { type RbacBundle } from "../api/rbacApi"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { cn } from "@/lib/utils"
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
    const mode: DrawerMode = modeProp ?? (initialData ? "edit" : "create")
    const isView = mode === "view"
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
        setLoading(true)
        try {
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
                contentClassName="p-0 flex flex-col overflow-hidden bg-card"
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
                            <fieldset disabled={isView || loading} className="contents">
                                <DrawerLayout
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                    rightRail={
                                        initialData?.id ? (
                                            <ActivitySidebar
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
                                                />
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

// ---------------------------------------------------------------------------
// Roles tab
// ---------------------------------------------------------------------------

interface RolesTabProps {
    form: ReturnType<typeof useForm<UserFormValues>>
    availableRoles: AppGroup[]
    bundleMeta: RbacBundle[]
    isLoading: boolean
}

function RolesTab({ form, availableRoles, bundleMeta, isLoading }: RolesTabProps) {
    const watchedRoles = form.watch("roles") ?? []
    const roleError = form.formState.errors.roles?.message

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 px-8 pt-6 pb-4">
                <div className="flex items-start gap-3">

                    <div className="space-y-0.5">
                        <h2 className="text-sm font-semibold text-foreground leading-snug">Roles de acceso</h2>
                        <p className="text-xs text-muted-foreground leading-snug">
                            Los roles definen qué puede ver, crear, modificar y aprobar el usuario en el sistema.
                            Cada rol agrupa permisos de uno o varios módulos.{" "}
                            <strong className="font-medium text-foreground/70">Obligatorio — mínimo uno.</strong>
                        </p>
                    </div>
                </div>
                {watchedRoles.length > 0 && (
                    <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-2xs font-semibold text-primary tabular-nums">
                        {watchedRoles.length} activo{watchedRoles.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Error banner */}
            {roleError && (
                <div className="shrink-0 flex items-center gap-2 mx-8 mt-4 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5">
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
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {availableRoles.map((role) => (
                                    <RoleCard
                                        key={role.id}
                                        role={role}
                                        bundleMeta={bundleMeta}
                                        checked={(field.value ?? []).includes(role.name)}
                                        onChange={(checked) => {
                                            const next = checked
                                                ? [...(field.value ?? []), role.name]
                                                : (field.value ?? []).filter((n) => n !== role.name)
                                            field.onChange(next)
                                        }}
                                    />
                                ))}
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Role card
// ---------------------------------------------------------------------------

interface RoleCardProps {
    role: AppGroup
    bundleMeta: RbacBundle[]
    checked: boolean
    onChange: (checked: boolean) => void
}

function RoleCard({ role, bundleMeta, checked, onChange }: RoleCardProps) {
    const access = useMemo(
        () => parseRoleAccess(role.bundles ?? [], bundleMeta),
        [role.bundles, bundleMeta]
    )

    const hasDetail = access.modules.length > 0 || !!role.description

    // Tooltip: grouped by module. Each module shows levels + capabilities.
    const tooltipContent = useMemo(() => {
        const lines: string[] = []
        if (role.description) lines.push(role.description)
        if (access.modules.length > 0) {
            if (lines.length) lines.push("")
            access.modules.forEach((m) => {
                const levelPart = m.levels.length > 0 ? m.levels.join(" · ") : ""
                const capPart = m.capabilities.length > 0 ? m.capabilities.join(", ") : ""
                const detail = [levelPart, capPart].filter(Boolean).join("  +  ")
                lines.push(`${m.label}: ${detail}`)
            })
        }
        return lines.join("\n")
    }, [role.description, access])

    // Plain-text module summary shown on the card (no chips)
    const moduleSummary = useMemo(() => {
        if (access.modules.length === 0) return ""
        return access.modules.map((m) => {
            const top = m.levels.at(-1) // highest level (Lectura < Operador < Gestor)
            const caps = m.capabilities.length > 0 ? ` +${m.capabilities.length}` : ""
            return top ? `${m.label} (${top}${caps})` : m.label
        }).join(" · ")
    }, [access])

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onChange(!checked)}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked) } }}
            className={cn(
                "group relative flex flex-col gap-2 rounded-sm border p-4 cursor-pointer",
                "transition-all duration-150 select-none outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                checked
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
            )}
        >
            {/* Top row: checkbox + name + info */}
            <div className="flex items-start gap-2.5">
                <Checkbox
                    checked={checked}
                    onCheckedChange={onChange}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                    aria-label={`Seleccionar rol ${role.name}`}
                />
                <span className={cn(
                    "flex-1 text-sm font-medium leading-snug",
                    checked ? "text-foreground" : "text-foreground/80"
                )}>
                    {role.name}
                </span>
                {hasDetail && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 mt-0.5 h-5 w-5 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-transparent transition-colors"
                                aria-label={`Ver detalle del rol ${role.name}`}
                            >
                                <Info className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            className="max-w-sm whitespace-pre-line text-left text-xs leading-relaxed"
                        >
                            {tooltipContent}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* Module summary — plain text, no chips */}
            {moduleSummary && (
                <p className="pl-[1.625rem] text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                    {moduleSummary}
                </p>
            )}

            {/* Fallback: description when no modules configured */}
            {!moduleSummary && role.description && (
                <p className="pl-[1.625rem] text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                    {role.description}
                </p>
            )}

            {/* Empty state */}
            {!moduleSummary && !role.description && (
                <p className="pl-[1.625rem] text-2xs text-muted-foreground/50 italic">
                    Sin módulos configurados
                </p>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Teams tab
// ---------------------------------------------------------------------------

interface TeamsTabProps {
    form: ReturnType<typeof useForm<UserFormValues>>
    availableTeams: AppGroup[]
    isLoading: boolean
}

function TeamsTab({ form, availableTeams, isLoading }: TeamsTabProps) {
    const watchedTeams = form.watch("teams") ?? []

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
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {availableTeams.map((team) => (
                                    <TeamCard
                                        key={team.id}
                                        team={team}
                                        checked={(field.value ?? []).includes(team.name)}
                                        onChange={(checked) => {
                                            const next = checked
                                                ? [...(field.value ?? []), team.name]
                                                : (field.value ?? []).filter((n) => n !== team.name)
                                            field.onChange(next)
                                        }}
                                    />
                                ))}
                            </div>
                        )
                    }}
                />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Team card
// ---------------------------------------------------------------------------

interface TeamCardProps {
    team: AppGroup
    checked: boolean
    onChange: (checked: boolean) => void
}

function TeamCard({ team, checked, onChange }: TeamCardProps) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onChange(!checked)}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!checked) } }}
            className={cn(
                "group relative flex items-start gap-2.5 rounded-sm border p-4 cursor-pointer",
                "transition-all duration-150 select-none outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                checked
                    ? "border-border/70 bg-secondary/60 shadow-sm"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
            )}
        >
            <Checkbox
                checked={checked}
                onCheckedChange={onChange}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
                aria-label={`Seleccionar equipo ${team.name}`}
            />
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-sm font-medium leading-snug",
                    checked ? "text-foreground" : "text-foreground/80"
                )}>
                    {team.name}
                </p>
                {team.description && (
                    <p className="mt-0.5 text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                        {team.description}
                    </p>
                )}
            </div>
            {team.description && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 mt-0.5 h-5 w-5 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-transparent transition-colors"
                            aria-label={`Ver detalle del equipo ${team.name}`}
                        >
                            <Info className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                        {team.description}
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
