"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "./UserActions"
import { ModuleRail } from "./ModuleRail"
import { ModuleSidebarPanel } from "./ModuleSidebarPanel"
import { useHeader } from "@/components/providers/HeaderProvider"

import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { PageHeaderSkeleton, PrepressPanel, DynamicIcon } from '@/components/shared'
import { Loader2, Menu } from "lucide-react"
import Link from "next/link"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const [isInboxOpen, setIsInboxOpen] = useState(false)
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

    const currentModuleId = pathname.split('/').filter(Boolean)[0] || 'dashboard'

    const { config, moduleNavigation } = useHeader()
    const { totalSheetsWidth } = useGlobalModals()
    
    // La navegación del módulo sobrevive a PageHeaders anidados sin `navigation` (ADR-0079)
    const nav = config?.navigation
        ?? (moduleNavigation?.moduleId === currentModuleId ? moduleNavigation.navigation : undefined)

    // Sync global data attributes for repelling fixed UI elements (like Sheets).
    // Attribute removal is deferred ~220ms so consumers (ActionDock, sheet padding)
    // shift back in sync with the 200ms panel exit instead of snapping.
    useEffect(() => {
        let inboxTimeout: NodeJS.Timeout | undefined

        if (isInboxOpen) {
            document.body.setAttribute('data-inbox-open', 'true')
        } else {
            inboxTimeout = setTimeout(() => document.body.removeAttribute('data-inbox-open'), 220)
        }

        return () => clearTimeout(inboxTimeout)
    }, [isInboxOpen])

    const handleInboxToggle = () => {
        setIsInboxOpen(prev => !prev)
    }

    const titleBlock = config ? (
        <div
            key={pathname + config.title}
            className="flex items-center gap-3 min-w-0 animate-in fade-in ease-premium duration-300 fill-mode-both motion-reduce:animate-none"
        >
            {config.isLoading && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            )}

            {/* Título de la vista = único <h1> de la página (ADR-0079, reemplaza ADR-0073 §1-2).
                La descripción queda como tooltip. */}
            <h1 title={config.description || undefined} className="flex items-center gap-2 min-w-0 text-base font-semibold tracking-tight text-foreground/90">
                {!config.isLoading && (config.icon ? (
                    <config.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : config.iconName ? (
                    <DynamicIcon name={config.iconName} className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : null)}
                <span className="truncate">{config.title}</span>
            </h1>
            {nav?.breadcrumbs?.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1.5 shrink-0 text-xs font-medium tracking-normal">
                    <span className="text-border select-none" aria-hidden>/</span>
                    {crumb.href ? (
                        <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-foreground/90">{crumb.label}</span>
                    )}
                </span>
            ))}

            <div className="flex items-center gap-2 shrink-0">
                {config.status && (
                    config.status.type === 'saving' ? (
                        <Skeleton className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border shrink-0 bg-primary/20 text-primary border-primary/20 flex items-center justify-center">
                            {config.status.label}
                        </Skeleton>
                    ) : (
                        <div className={cn(
                            "px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border shrink-0",
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

            {config.children && (
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0">
                    {config.children}
                </div>
            )}
        </div>
    ) : (
        <PageHeaderSkeleton />
    )

    const sidebar = (onNavigate?: () => void) => (
        <>
            <ModuleRail currentModuleId={currentModuleId} onNavigate={onNavigate} />
            <ModuleSidebarPanel
                currentModuleId={currentModuleId}
                navigation={nav}
                isHeaderReady={!!config}
                isInboxOpen={isInboxOpen}
                onInboxToggle={handleInboxToggle}
                onNavigate={onNavigate}
            />
        </>
    )

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* ── SIDEBAR (riel de módulos + panel del módulo, ADR-0079) ───── */}
            <aside className="hidden md:flex h-full shrink-0 z-40">
                {sidebar()}
            </aside>

            {/* Móvil: el sidebar completo se abre como drawer */}
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetContent side="left" hideCloseButton className="w-auto max-w-[90vw] p-0 flex-row gap-0">
                    <SheetTitle className="sr-only">Navegación</SheetTitle>
                    {sidebar(() => setIsMobileNavOpen(false))}
                </SheetContent>
            </Sheet>

            <div className="flex-1 flex flex-col min-w-0">
                {/* ── TOP BAR: ancho completo; los paneles laterales abren debajo
                     (top: --header-height), así las acciones no se desplazan. ── */}
                <header className="flex-none h-12 flex items-center gap-3 border-b border-border/40 bg-background z-30 pl-4 md:pl-6 pr-2 md:pr-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-8 w-8 shrink-0 -ml-2"
                        onClick={() => setIsMobileNavOpen(true)}
                        aria-label="Abrir navegación"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>

                    <div className="flex-1 flex items-center min-w-0">
                        {titleBlock}
                    </div>

                    <div className="flex-none flex items-center">
                        <UserActions />
                    </div>
                </header>

                {/* ── CONTENT AREA (se repliega ante sheets globales) ─────── */}
                <div
                    className="flex-1 min-h-0 flex flex-col relative transition-[margin-right] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ marginRight: `${totalSheetsWidth}px` }}
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
