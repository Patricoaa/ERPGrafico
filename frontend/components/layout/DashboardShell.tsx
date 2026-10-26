"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { ModuleRail } from "./ModuleRail"
import { ModuleSidebarPanel } from "./ModuleSidebarPanel"
import { WorkspaceTabBar } from "./WorkspaceTabBar"
import { useHeader } from "@/components/providers/HeaderProvider"

import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { PrepressPanel } from '@/components/shared'
import { Menu } from "lucide-react"

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

    // Estado, acciones y controles de la vista: viven en el extremo derecho de la barra de trabajo.
    const pageActions = config ? (
        <div className="flex items-center gap-2 min-w-0">
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
                <div className="flex items-center">
                    {config.titleActions}
                </div>
            )}

            {config.children && (
                <div className="flex items-center gap-2 pl-3 border-l border-border shrink-0">
                    {config.children}
                </div>
            )}
        </div>
    ) : null

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
                {/* ── BARRA DE TRABAJO: primer panel del viewport (ADR-0101). Mide --header-height:
                     los paneles laterales abren debajo, así las acciones no se desplazan. ── */}
                <WorkspaceTabBar
                    page={config ? { title: config.title, description: config.description, icon: config.icon, iconName: config.iconName, isLoading: config.isLoading } : null}
                    breadcrumbs={nav?.breadcrumbs}
                    actions={pageActions}
                    leading={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-8 w-8 shrink-0 mb-0.5"
                            onClick={() => setIsMobileNavOpen(true)}
                            aria-label="Abrir navegación"
                        >
                            <Menu className="h-4 w-4" />
                        </Button>
                    }
                />

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
