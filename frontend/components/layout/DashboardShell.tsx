"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { HubPanelProvider, useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { UserActions } from "@/components/layout/UserActions"

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
                className="h-full flex flex-col min-w-0 relative transition-[margin-right] duration-500 ease-[var(--ease-premium)] pt-20 pb-4 px-4"
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
                <main className="flex-1 bg-transparent border border-white/5 rounded-2xl overflow-y-auto shadow-2xl custom-scrollbar relative backdrop-blur-sm">
                    {/* El contenido ahora está encapsulado en un card que coincide con 
                        el estilo de la bandeja de entrada y el hub */}
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
