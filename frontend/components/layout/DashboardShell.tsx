"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"
import { UserSidebarMenu } from "@/components/layout/UserSidebarMenu"
import { useHeader } from "@/components/providers/HeaderProvider"

import { Skeleton } from "@/components/ui/skeleton"
import { ModuleNavigationMenu, PageHeaderSkeleton, PrepressPanel, DynamicIcon, CMYK_ACCENT } from '@/components/shared'
import { Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { getModuleIconName, MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import Link from "next/link"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBranding } from "@/contexts/BrandingProvider"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const currentModuleId = pathname.split('/').filter(Boolean)[0] || 'dashboard'

    const { config } = useHeader()
    const { isHubEffectivelyOpen } = useHubPanel()
    const { totalSheetsWidth } = useGlobalModals()
    
    const { logo, company } = useBranding()
    const companyName = company?.trade_name || company?.name
    const initials = companyName?.substring(0, 2).toUpperCase() || "ERP"

    const nav = config?.navigation

    // Sync global data attributes for repelling fixed UI elements (like Sheets).
    // Attribute removal is deferred ~220ms so consumers (ActionDock, sheet padding)
    // shift back in sync with the 200ms panel exit instead of snapping.
    useEffect(() => {
        let inboxTimeout: NodeJS.Timeout | undefined
        let hubTimeout: NodeJS.Timeout | undefined

        if (isInboxOpen) {
            document.body.setAttribute('data-inbox-open', 'true')
        } else {
            inboxTimeout = setTimeout(() => document.body.removeAttribute('data-inbox-open'), 220)
        }

        if (isHubEffectivelyOpen) {
            document.body.setAttribute('data-hub-open', 'true')
        } else {
            hubTimeout = setTimeout(() => document.body.removeAttribute('data-hub-open'), 220)
        }

        return () => {
            clearTimeout(inboxTimeout)
            clearTimeout(hubTimeout)
        }
    }, [isInboxOpen, isHubEffectivelyOpen])

    const handleInboxToggle = () => {
        setIsInboxOpen(prev => !prev)
    }

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden font-sans">
            {/* ── TOP BAR (FULL WIDTH) ────────────────────────────────────────────── */}
            <div className="flex-none h-12 flex items-center bg-background z-30 pr-4 md:pr-6">
                {/* ── LEFT: Logo (Aligned with Sidebar, sin bordes) ──────────────── */}
                <div className="w-10 shrink-0 h-full flex items-center justify-center bg-muted/10">
                    <div className="pointer-events-auto flex items-center justify-center">
                        {logo ? (
                            <div className="relative h-8 w-8">
                                <Image
                                    src={logo}
                                    alt={companyName || "Logo"}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/10 text-primary font-bold text-3xs">
                                {initials}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── REST OF TOP BAR (border-b empieza después del logo) ───────── */}
                <div className="flex-1 self-stretch flex items-center border-b border-border/40">
                    {/* ── MIDDLE: Page Title & Meta ──────────────────────────────── */}
                    <div className="flex-1 flex items-center gap-4 pl-4 md:pl-6 min-w-0 pointer-events-none">
                        {config ? (
                            <div
                                key={pathname + config.title}
                                className="flex items-center gap-3 pointer-events-auto min-w-0 animate-in fade-in slide-in-from-left-1 ease-premium duration-300 fill-mode-both"
                            >
                                {config.isLoading && (
                                    <Skeleton className="p-2 bg-primary/10 text-primary border border-primary/10 shadow-card shrink-0">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </Skeleton>
                                )}

                                {/* Texts & Icons Wrapper */}
                                <div className="flex items-center gap-5">
                                    {/* Left: Title — dropdown nav or static */}
                                    {config.navigation ? (
                                        <ModuleNavigationMenu
                                            navigation={config.navigation}
                                        />
                                    ) : (
                                        <div className="flex flex-col w-min">
                                            <h1 className="text-base font-semibold tracking-tight text-foreground/90 whitespace-nowrap flex items-center gap-2">
                                                {config.icon ? (
                                                    <config.icon className="h-4 w-4 text-primary/70 shrink-0" />
                                                ) : config.iconName ? (
                                                    <DynamicIcon name={config.iconName} className="h-4 w-4 text-primary/70 shrink-0" />
                                                ) : null}
                                                {config.title}
                                            </h1>
                                        </div>
                                    )}

                                    {/* Right: Icons & Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {config.status && (
                                            config.status.type === 'saving' ? (
                                                <Skeleton className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-tighter border shrink-0 bg-primary/20 text-primary border-primary/20 flex items-center justify-center">
                                                    {config.status.label}
                                                </Skeleton>
                                            ) : (
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-tighter border shrink-0",
                                                    config.status.type === 'synced' && "bg-success/10 text-success border-success/20",
                                                    config.status.type === 'error' && "bg-destructive/10 text-destructive border-destructive/20",
                                                    !config.status.type && "bg-muted text-muted-foreground border-border"
                                                )}>
                                                    {config.status.label}
                                                </div>
                                            )
                                        )}

                                        {config.titleActions && (
                                            <div className="flex items-center ml-1">
                                                {config.titleActions}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {config.children && (
                                    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0">
                                        {config.children}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <PageHeaderSkeleton />
                        )}
                    </div>

                    {/* Right: UserActions */}
                    <div className="flex-none flex items-center gap-4">
                        <UserActions isInboxOpen={isInboxOpen} onInboxToggle={handleInboxToggle} />
                    </div>
                </div>
            </div>

            {/* ── MAIN LAYOUT ────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ── LEFT SIDEBAR (MODULES) ──────────────────────────────────────── */}
                <div className="w-10 shrink-0 h-full border-r border-border/40 flex flex-col items-center py-4 bg-muted/10 z-40">
                    {/* Top spacer to center modules */}
                    <div className="flex-1" />
                    
                    <div className="flex flex-col items-center gap-3">
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
                                            className={cn(
                                                "relative w-8 h-8 rounded-md transition-all duration-200 group flex items-center justify-center",
                                                isActive 
                                                  ? accent.text
                                                  : cn("text-muted-foreground", accent.hoverText)
                                            )}
                                        >
                                            <Icon className="w-4 h-4 transition-colors" />
                                            {/* Borde derecho grueso al estar seleccionado / en hover */}
                                            <div className={cn(
                                                "absolute right-0 top-1/2 -translate-y-1/2 h-[60%] w-[4px] rounded-l-sm",
                                                "transition-opacity duration-200",
                                                accent.bar,
                                                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )} />
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="font-semibold text-xs border-border/50">{mod.label}</TooltipContent>
                                </Tooltip>
                            )
                        })}
                    </TooltipProvider>
                    </div>

                    {/* Bottom part (User menu) */}
                    <div className="flex-1 flex flex-col justify-end items-center pb-2">
                        <UserSidebarMenu />
                    </div>
                </div>

                {/* ── CONTENT AREA ────────────────────────────────────────────── */}
                <div
                    className="flex-1 flex flex-col min-w-0 relative transition-[margin-right] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                    marginRight: `${totalSheetsWidth}px`,
                }}
            >
                <PrepressPanel
                    id="main-content"
                    className="flex-1 flex flex-col overflow-hidden relative flush-panel"
                >
                    <div
                        className="w-full flex-1 flex flex-col min-h-0 animate-in fade-in ease-premium fill-mode-both motion-reduce:animate-none motion-reduce:opacity-100"
                        style={{
                            animationDuration: "0.35s",
                            "--tw-enter-translate-y": "8px",
                        } as React.CSSProperties}
                    >
                        {children}
                    </div>
                </PrepressPanel>
            </div>
        </div>

            {/* Task Inbox Sidebar (Right) */}
            <TaskInboxSidebar
                isOpen={isInboxOpen}
                onClose={() => setIsInboxOpen(false)}
            />

            <Toaster />
        </div>
    )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShellInner>{children}</DashboardShellInner>
    )
}
