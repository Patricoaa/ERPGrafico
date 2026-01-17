"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { TopBar } from "@/components/layout/TopBar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        // Allow access to login page without token
        if (pathname === "/login") {
            setAuthorized(true)
            return
        }

        const token = localStorage.getItem("access_token")
        if (!token) {
            setAuthorized(false)
            router.push("/login")
        } else {
            setAuthorized(true)
        }
    }, [pathname, router])

    const [activeCategory, setActiveCategory] = useState<string | null>("dashboard")
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
    const [isSidebarVisible, setIsSidebarVisible] = useState(false)

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
            }, 300) // Small delay before hiding
        }
        return () => clearTimeout(timeout)
    }, [hoveredCategory])

    if (!authorized) {
        // Can show a loading spinner here
        return null;
    }

    if (pathname === "/login") {
        return (
            <main className="w-full h-full">
                {children}
                <Toaster />
            </main>
        )
    }

    const categoryToUrl: Record<string, string> = {
        "dashboard": "/",
        "accounting": "/accounting/accounts",
        "contacts": "/contacts",
        "sales": "/sales/orders",
        "billing": "/billing/sales",
        "inventory": "/inventory/products",
        "production": "/production/orders",
        "treasury": "/treasury/accounts",
        "purchasing": "/purchasing/orders",
        "finances": "/finances/statements",
    }

    // Determine which category to show in the detailed sidebar
    const displayCategory = hoveredCategory || activeCategory

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans border-t border-sidebar-border/10">
            {/* First Level: Mini Sidebar */}
            <MiniSidebar
                activeCategory={activeCategory}
                onCategoryChange={(cat: string) => {
                    if (categoryToUrl[cat]) {
                        router.push(categoryToUrl[cat])
                    }
                }}
                onHoverCategory={setHoveredCategory}
            />

            {/* Second Level: Detailed Sidebar (Floating Glass Effect) */}
            <AppSidebar
                activeCategory={displayCategory}
                isVisible={isSidebarVisible}
                onMouseEnter={() => setHoveredCategory(displayCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <TopBar />
                <main className="flex-1 overflow-y-auto pb-24">
                    <div className="p-6 w-full">
                        {children}
                    </div>
                </main>
                <QuickActionsMenu />
            </div>

            <Toaster />
        </div>
    )
}
