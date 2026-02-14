"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { isAuthenticated, isLoading } = useAuth()

    const isLoginPath = pathname === "/login"

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !isLoginPath) {
            router.push("/login")
        }
    }, [isLoading, isAuthenticated, isLoginPath, router])

    // While loading or not authenticated (and not on login page), don't show children
    if (!isLoginPath && (isLoading || !isAuthenticated)) {
        return null
    }

    return (
        <>
            {children}
        </>
    )
}
