"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

// Lazy load: solo se compila al abrir el inbox, no en la carga inicial de cada página
const TaskInboxSidebar = dynamic(
    () => import("@/components/layout/TaskInboxSidebar").then(m => ({ default: m.TaskInboxSidebar })),
    { ssr: false }
)

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()

    const [activeCategory, setActiveCategory] = useState<string | null>("dashboard")
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
    const [isSidebarVisible, setIsSidebarVisible] = useState(false)
    const [isInboxOpen, setIsInboxOpen] = useState(false)

    useEffect(() => {
        // Sync active category with URL
        const path = pathname.split('/')[1] || "dashboard"
        setActiveCategory(path)
    }, [pathname])

    useEffect(() => {
        let timeout: NodeJS.Timeout
        if (hoveredCategory) {
            setIsSidebarVisible(true)
        } else {
            timeout = setTimeout(() => {
                setIsSidebarVisible(false)
            }, 300)
        }
        return () => clearTimeout(timeout)
    }, [hoveredCategory])

    const categoryToUrl: Record<string, string> = {
        "dashboard": "/",
        "accounting": "/accounting/accounts",
        "contacts": "/contacts",
        "sales": "/sales/orders",
        "billing": "/billing/sales",
        "inventory": "/inventory/products",
        "production": "/production/orders",
        "treasury": "/treasury/movements",
        "purchasing": "/purchasing/orders",
        "finances": "/finances/statements",
        "tax": "/tax/declarations",
        "hr": "/hr/employees",
    }

    const displayCategory = hoveredCategory || activeCategory

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
                onHoverCategory={setHoveredCategory}
            />

            {/* Detailed Sidebar (Floating Glass Effect) */}
            <AppSidebar
                activeCategory={displayCategory}
                isVisible={isSidebarVisible}
                onMouseEnter={() => setHoveredCategory(displayCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
            />

            {/* Main Content Area (Shifts left when inbox is open) */}
            <div
                className={cn(
                    "flex-1 flex flex-col min-w-0 relative transition-all duration-300",
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
                    onInboxToggle={() => setIsInboxOpen(!isInboxOpen)}
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
