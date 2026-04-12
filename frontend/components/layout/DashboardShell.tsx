"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { HubPanelProvider, useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"
import { useHeader } from "@/components/providers/HeaderProvider"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()

    const [activeCategory, setActiveCategory] = useState<string | null>("dashboard")
    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const { config } = useHeader()
    const { isHubOpen, hubConfig, closeHub, isHubTemporarilyHidden, isDocked, isHubEffectivelyOpen } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()


    useEffect(() => {
        // Sync active category with URL
        const path = pathname.split('/')[1] || "dashboard"
        setActiveCategory(path)
    }, [pathname])


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

    const categoryToUrl: Record<string, string> = {
        "dashboard": "/",
        "accounting": "/accounting",
        "contacts": "/contacts",
        "sales": "/sales",
        "billing": "/billing",
        "inventory": "/inventory",
        "production": "/production",
        "treasury": "/treasury",
        "purchasing": "/purchasing",
        "finances": "/finances",
        "tax": "/tax",
        "hr": "/hr",
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

            {/* Main Content Area - Wrapped in a Premium Card */}
            <div
                className="h-full flex flex-col min-w-0 relative transition-[margin-right] duration-500 ease-[var(--ease-premium)] pt-[84px] pb-4 px-4"
                style={{
                    marginRight: isInboxOpen && isHubEffectivelyOpen
                        ? "calc(360px + 320px + 2rem)"
                        : isHubEffectivelyOpen
                            ? "calc(360px + 1rem)"
                            : isInboxOpen
                                ? "calc(320px + 1rem)"
                                : "0px"
                }}
            >
                {/* Global Header Slot - Transversal */}
                <div className="absolute top-0 left-0 right-0 h-[84px] flex items-center px-4 pointer-events-none">
                    <div className="flex items-center gap-4 w-full pl-16 pr-[320px]">
                        <AnimatePresence mode="wait">
                            {config && (
                                <motion.div
                                    key={pathname + config.title}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-4 pointer-events-auto"
                                >
                                    {/* Removed leading icon to avoid saturating layout */}
                                    {config.isLoading && (
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-sm shrink-0 animate-pulse">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        </div>
                                    )}

                                    {/* Text Content */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-xl font-black tracking-tight font-heading uppercase text-foreground leading-none">
                                                {config.title}
                                            </h1>

                                            {/* Config Action (Settings Gear) */}
                                            {config.configHref && (
                                                <Link href={config.configHref} className="pointer-events-auto">
                                                    <motion.div
                                                        whileHover={{ rotate: 90, scale: 1.1 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="p-1 rounded-lg text-muted-foreground/50 hover:text-primary transition-colors"
                                                    >
                                                        <DynamicIcon name="settings" className="h-4 w-4" />
                                                    </motion.div>
                                                </Link>
                                            )}
                                            
                                            {/* Status */}
                                            {config.status && (
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border",
                                                    config.status.type === 'synced' && "bg-success/10 text-success border-success/20",
                                                    config.status.type === 'saving' && "bg-primary/20 text-primary border-primary/20 animate-pulse",
                                                    config.status.type === 'error' && "bg-destructive/10 text-destructive border-destructive/20",
                                                    !config.status.type && "bg-muted text-muted-foreground border-border"
                                                )}>
                                                    {config.status.label}
                                                </div>
                                            )}

                                            {/* Title Actions */}
                                            {config.titleActions && (
                                                <div className="flex items-center ml-1">
                                                    {config.titleActions}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {config.description && (
                                            <p className="text-[11px] text-muted-foreground font-medium truncate max-w-[400px] mt-1 opacity-70">
                                                {config.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right Side Actions (the children of PageHeader) */}
                                    {config.children && (
                                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/5">
                                            {config.children}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <main id="main-content" className="flex-1 bg-transparent border border-white/5 rounded-2xl overflow-y-auto shadow-2xl custom-scrollbar relative backdrop-blur-sm">
                    <div className="w-full h-full">
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
            {/* User Avatar & Notifications - Top Right Preventive Space */}
            <div className="fixed top-4 right-4 z-[60]">
                <UserActions 
                    isInboxOpen={isInboxOpen} 
                    onInboxToggle={handleInboxToggle} 
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
