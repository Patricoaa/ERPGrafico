"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"
import { useHeader } from "@/components/providers/HeaderProvider"

import { Skeleton } from "@/components/ui/skeleton"
import { ModuleNavigationMenu, PageHeaderSkeleton, PrepressPanel, TabBar, DynamicIcon } from '@/components/shared'
import { Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { getModuleIconName, MODULE_ORDER, getModuleConfig, getModuleIcon } from "@/lib/module-registry"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const currentModuleId = pathname.split('/').filter(Boolean)[0] || 'dashboard'

    const { config } = useHeader()
    const { isHubEffectivelyOpen } = useHubPanel()
    const { totalSheetsWidth } = useGlobalModals()

    const nav = config?.navigation
    let l4Tabs: { value: string; label: string; href: string }[] = []
    let activeL4Tab = ""

    if (nav && nav.subSubActiveValue) {
        const activeTab = nav.tabs.find(t => t.value === nav.activeValue)
        const activeSubTab = activeTab?.subTabs?.find(st => st.value === nav.subActiveValue)
        if (activeSubTab?.subTabs) {
            l4Tabs = activeSubTab.subTabs.map(t => ({ value: t.value, label: t.label, href: t.href }))
            activeL4Tab = nav.subSubActiveValue
        }
    }

    // Sync global data attributes for repelling fixed UI elements (like Sheets)
    useEffect(() => {
        if (isInboxOpen) {
            document.body.setAttribute('data-inbox-open', 'true')
        } else {
            document.body.removeAttribute('data-inbox-open')
        }

        if (isHubEffectivelyOpen) {
            document.body.setAttribute('data-hub-open', 'true')
        } else {
            document.body.removeAttribute('data-hub-open')
        }
    }, [isInboxOpen, isHubEffectivelyOpen])

    const handleInboxToggle = () => {
        setIsInboxOpen(prev => !prev)
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* ── LEFT SIDEBAR (MODULES) ──────────────────────────────────────── */}
            <div className="w-[60px] shrink-0 h-full border-r border-border/40 flex flex-col items-center py-4 bg-muted/10 gap-3 z-40">
                <TooltipProvider delayDuration={0}>
                    {MODULE_ORDER.map(modId => {
                        const mod = getModuleConfig(modId)
                        if (!mod) return null
                        const isActive = currentModuleId === modId
                        const Icon = getModuleIcon(modId)
                        return (
                            <Tooltip key={modId}>
                                <TooltipTrigger asChild>
                                    <Link 
                                        href={mod.defaultUrl}
                                        className={cn(
                                            "relative w-10 h-10 rounded-md transition-all duration-200 group flex items-center justify-center",
                                            isActive 
                                              ? "text-primary" 
                                              : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                                        )}
                                    >
                                        <Icon className="w-5 h-5 transition-colors" />
                                        {/* Borde inferior grueso al estar seleccionado */}
                                        {isActive && (
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[3px] bg-primary rounded-t-sm" />
                                        )}
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="font-semibold text-xs border-border/50">{mod.label}</TooltipContent>
                            </Tooltip>
                        )
                    })}
                </TooltipProvider>
            </div>

            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                {/* ── TOP BAR ────────────────────────────────────────────── */}
                <div className="absolute top-0 left-0 right-0 h-16 flex items-center bg-background z-30 gap-3 px-4 md:px-6 border-b border-border/40">                {/* Left: page title & meta — fills remaining space */}
                <div className="flex-1 flex items-center gap-4 min-w-0 pointer-events-none">
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
                                            <Skeleton className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-tighter border shrink-0 bg-primary/20 text-primary border-primary/20 flex items-center justify-center">
                                                {config.status.label}
                                            </Skeleton>
                                        ) : (
                                            <div className={cn(
                                                "px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-tighter border shrink-0",
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
                <div className="flex-none flex items-center gap-3">
                    <UserActions isInboxOpen={isInboxOpen} onInboxToggle={handleInboxToggle} />
                </div>
            </div>

            <div
                className="h-full flex flex-col min-w-0 relative transition-[margin-right] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pt-[var(--header-height)]"
                style={{
                    marginRight: `${totalSheetsWidth}px`,
                }}
            >
                {l4Tabs.length > 0 && (
                    <div className="flex-none px-8 pb-2">
                        <TabBar
                            items={l4Tabs}
                            value={activeL4Tab}
                            onValueChange={(val) => {
                                const tab = l4Tabs.find(t => t.value === val)
                                if (tab) router.push(tab.href)
                            }}
                            variant="underline"
                            dense
                        >
                            <div className="hidden" />
                        </TabBar>
                    </div>
                )}
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
