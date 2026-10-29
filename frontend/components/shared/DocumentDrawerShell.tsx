"use client"

import { isValidElement, useState, type ComponentType, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { formDrawerWidth } from "@/lib/form-widths"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { Drawer } from "./Drawer"
import { FormSplitLayout } from "./FormSplitLayout"
import type { PanelBaseProps } from "./PanelHeader"
import { SkeletonShell } from "./SkeletonShell"
import { TabBar, TabBarContent } from "./TabBar"

/**
 * Ficha documental común (ADR-0080 GAP-10, ADR-0083; contrato component-document-sheet.md).
 *
 * Zonas, de arriba abajo: encabezado (identidad del caller vía useDrawerIdentity, "Volver a…"
 * lo aporta `Drawer`; las acciones van en `headerActions` con `DocumentActionsMenu`), ciclo
 * (`DocumentLifecycle`), tabs (Resumen · Relaciones · propios) y sidebar de actividad.
 *
 * `embedded` renderiza solo el cuerpo, sin Drawer, para vistas incrustadas (POS).
 * Para fichas estándar usar `DocumentSheet` (@/features/documents), que compone este shell.
 */
export interface DocumentSheetTab {
    value: string
    label: string
    icon?: LucideIcon
    badge?: string | number
    hidden?: boolean
    content: ReactNode
}

export interface DocumentDrawerShellProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: PanelBaseProps["title"]
    subtitle?: PanelBaseProps["subtitle"]
    icon?: PanelBaseProps["icon"]
    headerActions?: ReactNode
    isLoading?: boolean
    error?: unknown
    /** Texto para el estado de carga (accesibilidad). */
    loadingLabel?: string
    /** Franja de ciclo (`DocumentLifecycle`). */
    lifecycle?: ReactNode
    tabs: DocumentSheetTab[]
    /** Tab controlado (opcional). Sin él, la ficha gestiona su propio tab. */
    tab?: string
    onTabChange?: (tab: string) => void
    defaultTab?: string
    /** Normalmente <ActivitySidebar /> de @/features/audit. */
    sidebar?: ReactNode
    /** Sin Drawer: solo el cuerpo (vista incrustada). */
    embedded?: boolean
    /** Lado del drawer: "left" | "right". Default: "left". */
    side?: "left" | "right"
    className?: string
}

export function DocumentDrawerShell(props: DocumentDrawerShellProps) {
    const { open, onOpenChange, title, subtitle, icon, headerActions, embedded, tabs, side } = props

    if (embedded) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
                    <EmbeddedIcon icon={icon} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-black tracking-tight">{title}</div>
                        {subtitle && <div className="truncate text-xs font-medium text-muted-foreground">{subtitle}</div>}
                    </div>
                    {headerActions && <div className="ml-auto flex items-center gap-1">{headerActions}</div>}
                </div>
                <DocumentSheetBody {...props} />
            </div>
        )
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side={side ?? "left"}
            boundary="embedded"
            defaultSize={formDrawerWidth("master", true)}
            title={title}
            subtitle={subtitle}
            icon={icon}
            headerActions={headerActions}
            mode="view"
            fillContent
            contentClassName="p-0"
        >
            <DocumentSheetBody {...props} />
        </Drawer>
    )
}

function EmbeddedIcon({ icon }: { icon: PanelBaseProps["icon"] }) {
    if (!icon) return null
    if (isValidElement(icon)) return icon
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)) {
        const Icon = icon as ComponentType<{ className?: string }>
        return <Icon className="h-5 w-5 shrink-0 text-primary" />
    }
    return null
}

function DocumentSheetBody({
    isLoading, error, loadingLabel = "Cargando documento",
    lifecycle, tabs, tab, onTabChange, defaultTab, sidebar, className,
}: DocumentDrawerShellProps) {
    if (isLoading) {
        // Skeleton con la forma de la ficha: ciclo, acciones, tabs y bloques de contenido.
        return (
            <SkeletonShell isLoading ariaLabel={loadingLabel} className="flex-1 space-y-4 p-6">
                <div className="h-12 rounded-md bg-muted" />
                <div className="h-8 w-1/2 rounded-md bg-muted" />
                <div className="h-40 rounded-md bg-muted" />
                <div className="h-24 rounded-md bg-muted" />
            </SkeletonShell>
        )
    }
    if (error) {
        return (
            <p role="alert" className="p-6 text-sm text-destructive">
                No se pudo cargar el documento: {getErrorMessage(error)}
            </p>
        )
    }
    return (
        <FormSplitLayout
            collapsible
            showSidebar={!!sidebar}
            sidebar={sidebar}
            className={cn("min-w-0 h-full overflow-hidden p-0", className)}
        >
            {lifecycle && <div className="shrink-0 border-b px-6 py-3">{lifecycle}</div>}
            <SheetTabs tabs={tabs} tab={tab} onTabChange={onTabChange} defaultTab={defaultTab} />
        </FormSplitLayout>
    )
}

function SheetTabs({ tabs, tab, onTabChange, defaultTab }: {
    tabs: DocumentSheetTab[]
    tab?: string
    onTabChange?: (tab: string) => void
    defaultTab?: string
}) {
    const visible = tabs.filter((t) => !t.hidden)
    const [ownTab, setOwnTab] = useState(defaultTab ?? visible[0]?.value ?? "")
    const current = tab ?? ownTab
    // Si el tab activo deja de estar visible, cae al primero.
    const active = visible.some((t) => t.value === current) ? current : (visible[0]?.value ?? "")
    const change = (value: string) => {
        setOwnTab(value)
        onTabChange?.(value)
    }

    return (
        <TabBar
            items={tabs.map(({ value, label, icon, badge, hidden }) => ({ value, label, icon, badge, hidden }))}
            value={active}
            onValueChange={change}
            orientation="horizontal"
            variant="underline"
            className="flex-1 min-h-0"
            contentClassName="bg-transparent"
        >
            {visible.map((t) => (
                <TabBarContent
                    key={t.value}
                    value={t.value}
                    className="mt-0 px-6 pt-4 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin"
                >
                    {t.content}
                </TabBarContent>
            ))}
        </TabBar>
    )
}
