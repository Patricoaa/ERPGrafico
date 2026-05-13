"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"
import { useHeader } from "@/components/providers/HeaderProvider"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, UniversalSearch } from "@/components/shared"
import { Loader2 } from "lucide-react"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { HeaderNavDropdowns } from "@/components/shared/HeaderNavDropdowns"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()

    const activeCategory = pathname.split('/')[1] || "dashboard"
    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const { config } = useHeader()
    const { isHubOpen, hubConfig, closeHub, isHubTemporarilyHidden, isDocked, isHubEffectivelyOpen } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()


    // Sync global data attributes for repelling fixed UI elements (like Sheets)
    const [featurePanelWidth, setFeaturePanelWidth] = useState(0)

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

        // Feature-specific side panels
        const observer = new MutationObserver(() => {
            const width = parseInt(document.body.getAttribute('data-side-panel-width') || "0")
            setFeaturePanelWidth(width)
        })
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-side-panel-width'] })
        return () => observer.disconnect()
    }, [isInboxOpen, isHubEffectivelyOpen])

    const handleInboxToggle = () => {
        setIsInboxOpen(prev => !prev)
    }

    const categoryToUrl: Record<string, string> = {
        "dashboard": "/",
        "accounting": "/accounting/ledger",
        "contacts": "/contacts",
        "sales": "/sales/orders?tab=orders",
        "billing": "/billing/invoices",
        "inventory": "/inventory/products?tab=products",
        "production": "/production",
        "treasury": "/treasury/movements",
        "purchasing": "/purchasing/orders?tab=orders",
        "finances": "/finances",
        "tax": "/tax",
        "hr": "/hr/employees",
    }


    return (
        <div className="relative h-screen bg-background overflow-hidden font-sans">
            {/* Mini Sidebar - Now Floating & Independent */}
            <MiniSidebar
                activeCategory={activeCategory}
                onCategoryChange={(cat: string) => {
                    if (categoryToUrl[cat]) {
                        router.push(categoryToUrl[cat])
                    }
                }}
            />

            {/* ── TOP BAR ────────────────────────────────────────────── */}
            <div className="absolute top-0 left-14 right-0 h-16 flex items-center bg-background z-30 px-6">

                {/* Center: page title & meta — takes remaining space */}
                <div className="flex-1 flex items-center gap-4 min-w-0 pointer-events-none">
                    <AnimatePresence mode="wait">
                        {config ? (
                            <motion.div
                                key={pathname + config.title}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-3 pointer-events-auto min-w-0"
                            >
                                {config.isLoading && (
                                    <Skeleton className="p-2 bg-primary/10 text-primary border border-primary/10 shadow-sm shrink-0">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </Skeleton>
                                )}

                                {/* Texts & Icons Wrapper */}
                                <div className="flex items-center gap-5">
                                    {/* Left: Title — dropdown nav or static */}
                                    {config.navigation ? (
                                        <HeaderNavDropdowns
                                            navigation={config.navigation}
                                            iconName={config.iconName}
                                        />
                                    ) : (
                                        <div className="flex flex-col w-min">
                                            <h1 className="text-sm font-semibold tracking-tight text-foreground/90 whitespace-nowrap flex items-center gap-2">
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
                                                <Skeleton className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border shrink-0 bg-primary/20 text-primary border-primary/20 flex items-center justify-center">
                                                    {config.status.label}
                                                </Skeleton>
                                            ) : (
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border shrink-0",
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
                                    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/5 shrink-0">
                                        {config.children}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <PageHeaderSkeleton />
                        )}
                    </AnimatePresence>
                </div>

                {/* Center-right: Universal Search */}
                <div className="shrink-0 mr-3">
                    <UniversalSearch />
                </div>

                {/* Right: UserActions */}
                <div className="shrink-0">
                    <UserActions isInboxOpen={isInboxOpen} onInboxToggle={handleInboxToggle} />
                </div>
            </div>

            <div
                className="h-full flex flex-col min-w-0 relative transition-[margin-right] duration-500 ease-[var(--ease-premium)] pt-20 pl-[4.5rem] pr-4 pb-4"
                style={{
                    marginRight: `calc(${(isInboxOpen ? 320 : 0) + (isHubEffectivelyOpen ? 360 : 0) + featurePanelWidth}px + ${((isInboxOpen ? 1 : 0) + (isHubEffectivelyOpen ? 1 : 0) + (featurePanelWidth ? 1 : 0)) * 16}px)`
                }}
            >
                {/* Railway-style Main Canvas */}
                <main
                    id="main-content"
                    className="flex-1 overflow-y-auto custom-scrollbar dot-grid bg-card border border-border/10 rounded-xl"
                >
                    <div className="w-full min-h-full p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>

            {/* Task Inbox Sidebar (Right) - Fixed position */}
            <div className="fixed right-0 top-0 h-screen z-40">
                <TaskInboxSidebar
                    isOpen={isInboxOpen}
                    onClose={() => setIsInboxOpen(false)}
                />
            </div>

            <Toaster />
        </div>
    )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShellInner>{children}</DashboardShellInner>
    )
}
