"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { MiniSidebar } from "@/components/layout/MiniSidebar"
import { TopBar } from "@/components/layout/TopBar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"

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

    useEffect(() => {
        // Sync active category with URL
        const path = pathname.split('/')[1] || "dashboard"
        setActiveCategory(path)
    }, [pathname])

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
        "services": "/services/contracts",
        "finances": "/finances/statements",
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* First Level: Mini Sidebar */}
            <MiniSidebar
                activeCategory={activeCategory}
                onCategoryChange={(cat: string) => {
                    if (categoryToUrl[cat]) {
                        router.push(categoryToUrl[cat])
                    }
                }}
            />

            {/* Second Level: Detailed Sidebar (Conditional) */}
            <AppSidebar activeCategory={activeCategory} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <TopBar />
                <main className="flex-1 overflow-y-auto scrollbar-hide">
                    {children}
                </main>
            </div>

            <Toaster />
        </div>
    )
}
