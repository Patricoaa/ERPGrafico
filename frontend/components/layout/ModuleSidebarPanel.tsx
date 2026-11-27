"use client"

import Image from "next/image"
import Link from "next/link"
import { Settings } from "lucide-react"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"
import { Can } from "@/components/auth"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBranding } from "@/contexts/BrandingProvider"
import { MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import { ModuleNavTree } from "./ModuleNavTree"
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
}

/**
 * Panel único de navegación (ADR-0162): identidad de la empresa, accesos globales,
 * módulos como primer nivel y, bajo el activo, sus vistas. Pie con Cuenta y Configuración.
 * En móvil se renderiza dentro del `Sheet` de `DashboardShell`.
 */
export function ModuleSidebarPanel({ currentModuleId, navigation, isInboxOpen, onInboxToggle, onNavigate, onProfileOpen }: ModuleSidebarPanelProps) {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name || "ERP"
    const initials = companyName.substring(0, 2).toUpperCase()
    const hasModuleNav = !!navigation && navigation.tabs.length > 0

    return (
        <div className="w-56 shrink-0 h-full flex flex-col border-r border-border/40 bg-muted/30">
            {/* Cabecera: identidad de la empresa en lugar del nombre del módulo */}
            <TooltipProvider delayDuration={0}>
                <div className="shrink-0 h-12 flex items-center gap-2 px-3 border-b border-border/40">
                    <Link
                        href="/accounting/ledger?view=list"
                        onClick={onNavigate}
                        aria-label="Inicio"
                        className="h-7 w-7 shrink-0 rounded-sm flex items-center justify-center overflow-hidden"
                    >
                        {logo ? (
                            <div className="relative h-7 w-7 rounded-sm overflow-hidden">
                                <Image src={logo} alt={companyName} fill className="object-contain" />
                            </div>
                        ) : (
                            <div className="h-7 w-7 rounded-sm flex items-center justify-center bg-primary text-primary-foreground font-bold text-3xs uppercase">
                                {initials}
                            </div>
                        )}
                    </Link>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground">{companyName}</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-semibold text-xs border-border/50">{companyName}</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>

            {/* Utilidades globales fijas: Buscar, Bandeja, POS y Calculadora (ADR-0162) */}
            <div className="shrink-0 bg-background/40 px-2 pt-2 flex flex-col gap-px">
                <SidebarUtilityNav isInboxOpen={isInboxOpen} onInboxToggle={onInboxToggle} />
                <div className="h-px bg-border/60 mx-2 my-2" aria-hidden />
                <SidebarQuickActions />
            </div>
            <div className="h-px bg-border/60 mx-2 shrink-0" aria-hidden />

            {/* Primer nivel = módulos; el activo despliega sus vistas debajo */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-2 flex flex-col gap-px">
                <nav aria-label="Módulos y vistas" className="flex flex-col gap-px">
                    {MODULE_ORDER.map(modId => {
                        const mod = getModuleConfig(modId)
                        if (!mod) return null
                        const isActive = modId === currentModuleId
                        const Icon = getModuleIcon(modId)
                        return (
                            <Can key={modId} permission={mod.permission}>
                                <div className="flex flex-col gap-px">
                                    <SidebarNavItem
                                        label={mod.label}
                                        href={mod.defaultUrl}
                                        icon={Icon}
                                        isActive={isActive}
                                        onClick={onNavigate}
                                    />
                                    {isActive && hasModuleNav && (
                                        <ModuleNavTree navigation={navigation} onNavigate={onNavigate} renderDepth={1} embedded />
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
                        onClick={onNavigate}
                    />
                </Can>
                <UserSidebarMenu variant="row" onProfileOpen={onProfileOpen} onNavigate={onNavigate} />
            </div>
        </div>
    )
}
