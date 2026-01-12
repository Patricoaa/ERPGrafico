"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full overflow-x-hidden">
                <SidebarTrigger className="md:hidden" />
                {children}
            </main>
            <Toaster />
        </SidebarProvider>
    )
}
