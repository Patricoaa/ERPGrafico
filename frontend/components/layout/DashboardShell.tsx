"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"
import { useHeader } from "@/components/providers/HeaderProvider"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { HeaderNavDropdowns, PageHeaderSkeleton } from '@/components/shared'
import { Loader2 } from "lucide-react"
import { DynamicIcon } from '@/components/shared'

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/features/workflow/components/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

function DashboardShellInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const shouldReduceMotion = useReducedMotion()

    const [isInboxOpen, setIsInboxOpen] = useState(false)

    const { config } = useHeader()
    const { isHubEffectivelyOpen } = useHubPanel()
    const { totalSheetsWidth } = useGlobalModals()

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
        <div className="relative h-screen bg-background overflow-hidden font-sans">
            {/* ── TOP BAR ────────────────────────────────────────────── */}
            <div className="absolute top-0 left-0 right-0 h-16 flex items-center bg-background z-30 gap-3 px-4 md:px-6">
                {/* Left: page title & meta — fills remaining space */}
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
                                    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border shrink-0">
                                        {config.children}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <PageHeaderSkeleton />
                        )}
                    </AnimatePresence>
                </div>

                {/* Right: UserActions */}
                <div className="flex-none flex items-center gap-3">
                    <UserActions isInboxOpen={isInboxOpen} onInboxToggle={handleInboxToggle} />
                </div>
            </div>

            <div
                className="h-full flex flex-col min-w-0 relative transition-[margin-right] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pt-[var(--page-padding-top)] pl-[var(--page-gap-left)] pr-[var(--page-gap-right)] pb-[var(--page-gap-bottom)]"
                style={{
                    marginRight: `${totalSheetsWidth}px`,
                }}
            >
                <main
                    id="main-content"
                    className="flex-1 flex flex-col overflow-hidden relative canvas-prepress panel-surface"
                >
                    <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : { y: 8, opacity: 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
                        transition={{
                            duration: 0.35,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                        className="w-full flex-1 flex flex-col min-h-0"
                    >
                        {children}
                    </motion.div>
                </main>
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
