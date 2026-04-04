"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { HubPanelProvider, useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

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


    // Mutually exclusive: close inbox when Hub opens
    useEffect(() => {
        if (isHubOpen && isInboxOpen) {
            setIsInboxOpen(false)
        }
    }, [isHubOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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
        const next = !isInboxOpen
        setIsInboxOpen(next)
        // Close Hub when opening inbox
        if (next && isHubOpen) {
            closeHub()
        }
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
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* Mini Sidebar (Left) */}
            <MiniSidebar
                activeCategory={activeCategory}
                onCategoryChange={(cat: string) => {
                    if (categoryToUrl[cat]) {
                        router.push(categoryToUrl[cat])
                    }
                }}
            />

            {/* Main Content Area */}
            <div
                className={cn(
                    "flex-1 flex flex-col min-w-0 relative transition-all duration-500 ease-in-out",
                    isInboxOpen && "mr-[320px] xl:mr-[25%] 2xl:mr-[450px]"
                )}
            >
                <main className="flex-1 overflow-y-auto pb-24">
                    <div className="p-0 w-full">
                        {children}
                    </div>
                </main>
                <QuickActionsMenu
                    isInboxOpen={isInboxOpen}
                    onInboxToggle={handleInboxToggle}
                />
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
