"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Settings } from "lucide-react"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"
import { Can } from "@/components/auth"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBranding } from "@/contexts/BrandingProvider"
import { MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import { ModuleNavTree } from "./ModuleNavTree"
import { getFallbackModuleNavigation } from "./module-nav-fallback"
import { SidebarNavItem } from "./SidebarNavItem"
import { SidebarUtilityNav } from "./SidebarUtilityNav"
import { SidebarQuickActions } from "./SidebarQuickActions"
import { UserSidebarMenu } from "./UserSidebarMenu"

interface ModuleSidebarPanelProps {
    currentModuleId: string
    /** Navegación publicada por el `[Module]Header` (estable por módulo, ver DashboardShell). */
    navigation?: NavigationConfig
    isInboxOpen?: boolean
    onInboxToggle?: () => void
    onNavigate?: () => void
    onProfileOpen: () => void
    onSettingsOpen?: () => void
}

/**
 * Panel único de navegación (ADR-0162): identidad de la empresa, accesos globales,
 * módulos como primer nivel y, bajo el activo, sus vistas. Pie con Cuenta y Configuración.
 * En móvil se renderiza dentro del `Sheet` de `DashboardShell`.
 */
export function ModuleSidebarPanel({ currentModuleId, navigation, isInboxOpen, onInboxToggle, onNavigate, onProfileOpen, onSettingsOpen }: ModuleSidebarPanelProps) {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name || "ERP"
    // Todos los módulos del primer nivel son acordeones sin redirección (Enmienda 1, ADR-0162).
    // El activo arranca abierto; el estado se conserva por módulo mientras el panel siga montado.
    const [openModules, setOpenModules] = useState<Record<string, boolean>>({})
    const toggleModule = (modId: string) => setOpenModules(prev => ({ ...prev, [modId]: !(prev[modId] ?? modId === currentModuleId) }))

    return (
        <div className="w-56 shrink-0 h-full flex flex-col bg-muted/30">
            {/* Cabecera: icono de empresa centrado; sin logo, el nombre de la empresa (Enmienda 1, ADR-0162) */}
            <TooltipProvider delayDuration={0}>
                <div className="shrink-0 h-12 flex items-center justify-center px-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href="/accounting/ledger?view=list"
                                onClick={onNavigate}
                                aria-label="Inicio"
                                className="max-w-full h-8 rounded-sm flex items-center justify-center overflow-hidden"
                            >
                                {logo ? (
                                    <div className="relative h-7 w-7 shrink-0 rounded-sm overflow-hidden">
                                        <Image src={logo} alt={companyName} fill className="object-contain" />
                                    </div>
                                ) : (
                                    <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">{companyName}</span>
                                )}
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-semibold text-xs border-border/50">{companyName}</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>

            {/* Utilidades globales fijas: Buscar, Bandeja, POS y Calculadora (ADR-0162) */}
            <div className="shrink-0 bg-background/40 px-2 pt-2 flex flex-col gap-px">
                <SidebarUtilityNav isInboxOpen={isInboxOpen} onInboxToggle={onInboxToggle} />
                <SidebarQuickActions />
            </div>
            <div className="h-px bg-border/60 mx-2 shrink-0" aria-hidden />

            {/* Primer nivel = módulos como acordeones; la fila nunca navega */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2 flex flex-col gap-px">
                <nav aria-label="Módulos y vistas" className="flex flex-col gap-px">
                    {MODULE_ORDER.map(modId => {
                        const mod = getModuleConfig(modId)
                        if (!mod) return null
                        const isActive = modId === currentModuleId
                        const Icon = getModuleIcon(modId)
                        const moduleNav = isActive && navigation?.tabs.length
                            ? navigation
                            : getFallbackModuleNavigation(modId)
                        const expanded = openModules[modId] ?? isActive
                        return (
                            <Can key={modId} permission={mod.permission}>
                                <div className="flex flex-col gap-px">
                                    <SidebarNavItem
                                        label={mod.label}
                                        icon={Icon}
                                        isActive={isActive}
                                        expanded={expanded}
                                        onClick={() => toggleModule(modId)}
                                    />
                                    {expanded && moduleNav && (
                                        <ModuleNavTree navigation={moduleNav} onNavigate={onNavigate} renderDepth={1} embedded />
                                    )}
                                </div>
                            </Can>
                        )
                    })}
                </nav>
            </div>

            {/* Pie: Configuración y Cuenta, antes en el riel de íconos */}
            <div className="shrink-0 bg-background/40 px-2 pb-2 flex flex-col gap-px">
                <div className="h-px bg-border/60 mx-2 mb-2" aria-hidden />
                <Can permission="core.change_companysettings">
                    <SidebarNavItem
                        label="Configuración"
                        href="/settings"
                        icon={Settings}
                        isActive={currentModuleId === "settings"}
                        onClick={(e) => {
                            if (onSettingsOpen) {
                                e.preventDefault()
                                onSettingsOpen()
                            }
                            onNavigate?.()
                        }}
                    />
                </Can>
                <UserSidebarMenu variant="row" onProfileOpen={onProfileOpen} onNavigate={onNavigate} />
            </div>
        </div>
    )
}
