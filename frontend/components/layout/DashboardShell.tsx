"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { ModuleSidebarPanel } from "./ModuleSidebarPanel"
import { WorkspaceTabBar } from "./WorkspaceTabBar"
import { useHeader } from "@/components/providers/HeaderProvider"

import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { PrepressPanel, fadeInClass } from '@/components/shared'
import { Menu } from "lucide-react"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

const ProfileSettingsModal = dynamic(
    () => import("@/features/profile").then(m => ({ default: m.ProfileSettingsModal })),
    { ssr: false },
)

const GlobalSettingsModal = dynamic(
    () => import("@/features/settings").then(m => ({ default: m.GlobalSettingsModal })),
    { ssr: false },
)

// ADR-0109: pide el motivo si un movimiento toca una caja POS con sesión abierta
const POSExternalReasonModal = dynamic(
    () => import("@/features/treasury").then(m => ({ default: m.POSExternalReasonModal })),
    { ssr: false },
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const [isInboxOpen, setIsInboxOpen] = useState(false)
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
    const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false)
    const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false)

    const currentModuleId = pathname.split('/').filter(Boolean)[0] || 'dashboard'

    const { config, moduleNavigation } = useHeader()
    const { totalSheetsWidth } = useGlobalModals()
    
    // La navegación del módulo sobrevive a PageHeaders anidados sin `navigation` (ADR-0079)
    const nav = config?.navigation
        ?? (moduleNavigation?.moduleId === currentModuleId ? moduleNavigation.navigation : undefined)

    // La bandeja es un overlay bloqueante: no publica `data-inbox-open` ni desplaza
    // el contenido ni el ActionDock (ADR-0161). La repulsión sigue vigente para los
    // drawers de entidad, gestionada por GlobalModalProvider.

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
                        config.status.type === 'synced' && "bg-success/10 text-success-text border-success/20",
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
        <ModuleSidebarPanel
            currentModuleId={currentModuleId}
            navigation={nav}
            isInboxOpen={isInboxOpen}
            onInboxToggle={handleInboxToggle}
            onNavigate={onNavigate}
            onProfileOpen={() => setIsProfileSettingsOpen(true)}
            onSettingsOpen={() => setIsGlobalSettingsOpen(true)}
        />
    )

    return (
        <div className="flex min-h-0 flex-1 bg-background overflow-hidden font-sans">
            {/* ── SIDEBAR (riel de módulos + panel del módulo, ADR-0079) ───── */}
            <aside className="hidden md:flex h-full shrink-0 z-40">
                {sidebar()}
            </aside>

            {/* Móvil: el panel único se abre como drawer */}
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetContent side="left" hideCloseButton className="w-56 max-w-[90vw] p-0">
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
                            className="md:hidden h-control-sm w-8 shrink-0 mb-0.5"
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
                            className={cn("w-full flex-1 flex flex-col min-h-0", fadeInClass({ ease: "premium" }))}
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

            {/* Task Inbox: overlay derecho a pantalla completa (ADR-0161) */}
            <TaskInboxSidebar
                isOpen={isInboxOpen}
                onClose={() => setIsInboxOpen(false)}
            />

            {isProfileSettingsOpen && (
                <ProfileSettingsModal onOpenChange={setIsProfileSettingsOpen} />
            )}

            {isGlobalSettingsOpen && (
                <GlobalSettingsModal onOpenChange={setIsGlobalSettingsOpen} />
            )}

            <POSExternalReasonModal />
            <Toaster />
        </div>
    )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShellInner>{children}</DashboardShellInner>
    )
}
