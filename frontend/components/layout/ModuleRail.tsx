"use client"

import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { CMYK_ACCENT } from "@/components/shared"
import { MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBranding } from "@/contexts/BrandingProvider"
import { UserSidebarMenu } from "./UserSidebarMenu"

interface ModuleRailProps {
    currentModuleId: string
    onNavigate?: () => void
    onProfileOpen: () => void
}

/**
 * Riel de módulos (columna de íconos) — primera columna del sidebar ERPNext v16 (ADR-0079).
 */
export function ModuleRail({ currentModuleId, onNavigate, onProfileOpen }: ModuleRailProps) {
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name
    const initials = companyName?.substring(0, 2).toUpperCase() || "ERP"

    return (
        <div className="w-14 shrink-0 h-full flex flex-col items-center border-r border-border/40 bg-muted/30">
            {/* Logo — alineado con la cabecera del panel y la topbar */}
            <Link href="/accounting/ledger?view=list" onClick={onNavigate} aria-label="Inicio" className="h-12 w-full shrink-0 flex items-center justify-center">
                {logo ? (
                    <div className="relative h-8 w-8 rounded-sm overflow-hidden">
                        <Image src={logo} alt={companyName || "Logo"} fill className="object-contain" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-primary text-primary-foreground font-bold text-3xs uppercase">
                        {initials}
                    </div>
                )}
            </Link>

            <nav aria-label="Módulos" className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center gap-1.5 py-2">
                <TooltipProvider delayDuration={0}>
                    {MODULE_ORDER.map((modId, index) => {
                        const mod = getModuleConfig(modId)
                        if (!mod) return null
                        const isActive = currentModuleId === modId
                        const Icon = getModuleIcon(modId)
                        const accent = CMYK_ACCENT[index % CMYK_ACCENT.length]
                        return (
                            <Tooltip key={modId}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={mod.defaultUrl}
                                        onClick={onNavigate}
                                        aria-label={mod.label}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cn(
                                            "w-10 h-10 shrink-0 rounded-sm flex items-center justify-center transition-colors duration-200",
                                            isActive
                                                ? cn("bg-card shadow-card", accent.text)
                                                : cn("text-muted-foreground hover:bg-foreground/5", accent.hoverText)
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="font-semibold text-xs border-border/50">{mod.label}</TooltipContent>
                            </Tooltip>
                        )
                    })}
                </TooltipProvider>
            </nav>

            <div className="shrink-0 py-3">
                <UserSidebarMenu onProfileOpen={onProfileOpen} onNavigate={onNavigate} />
            </div>
        </div>
    )
}
