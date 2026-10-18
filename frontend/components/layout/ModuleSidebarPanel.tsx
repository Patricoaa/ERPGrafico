"use client"

import type { NavigationConfig } from "@/components/providers/HeaderProvider"
import { Skeleton } from "@/components/ui/skeleton"
import { MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import { ModuleNavTree } from "./ModuleNavTree"
import { SidebarNavItem } from "./SidebarNavItem"
import { SidebarUtilityNav } from "./SidebarUtilityNav"
import { SidebarQuickActions } from "./SidebarQuickActions"

interface ModuleSidebarPanelProps {
    currentModuleId: string
    /** Navegación publicada por el `[Module]Header` (estable por módulo, ver DashboardShell). */
    navigation?: NavigationConfig
    /** `false` mientras ninguna vista ha publicado su header (primer frame tras navegar). */
    isHeaderReady: boolean
    isInboxOpen?: boolean
    onInboxToggle?: () => void
    onNavigate?: () => void
}

/**
 * Panel del módulo activo — segunda columna del sidebar ERPNext v16 (ADR-0079).
 * Accesos globales (Buscar, Bandeja) arriba; debajo, el árbol de vistas del módulo.
 */
export function ModuleSidebarPanel({ currentModuleId, navigation, isHeaderReady, isInboxOpen, onInboxToggle, onNavigate }: ModuleSidebarPanelProps) {
    const hasModuleNav = !!navigation && navigation.tabs.length > 0

    const moduleLabel = hasModuleNav
        ? navigation.moduleName
        : undefined

    return (
        <div className="w-56 shrink-0 h-full flex flex-col border-r border-border/40 bg-muted/30">
            {/* Cabecera del panel: nombre del módulo activo */}
            <div className="shrink-0 h-12 flex items-center justify-center px-4 border-b border-border/40">
                {moduleLabel ? (
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                        {moduleLabel}
                    </span>
                ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                        Módulos
                    </span>
                )}
            </div>

            {/* Utilidades globales fijas en la parte superior (simetría con SidebarQuickActions abajo) */}
            <div className="shrink-0 bg-background/40 px-2 pt-2 flex flex-col gap-px">
                <SidebarUtilityNav isInboxOpen={isInboxOpen} onInboxToggle={onInboxToggle} />
                <div className="h-px bg-border/60 mx-2" aria-hidden />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pt-2 pb-4 flex flex-col gap-3">
                {hasModuleNav ? (
                    <ModuleNavTree navigation={navigation} onNavigate={onNavigate} />
                ) : isHeaderReady || navigation ? (
                    // Rutas sin navegación de módulo (dashboard): lista de módulos
                    <nav aria-label="Módulos" className="flex flex-col gap-px">
                        {MODULE_ORDER.map(modId => {
                            const mod = getModuleConfig(modId)
                            if (!mod) return null
                            return (
                                <SidebarNavItem
                                    key={modId}
                                    label={mod.label}
                                    href={mod.defaultUrl}
                                    icon={getModuleIcon(modId)}
                                    isActive={modId === currentModuleId}
                                    onClick={onNavigate}
                                />
                            )
                        })}
                    </nav>
                ) : (
                    <div className="flex flex-col gap-2 px-2 pt-1" aria-hidden>
                        {Array.from({ length: 6 }, (_, i) => (
                            <Skeleton key={i} className="h-5 w-full rounded-md" />
                        ))}
                    </div>
                )}
            </div>

            <SidebarQuickActions />
        </div>
    )
}
