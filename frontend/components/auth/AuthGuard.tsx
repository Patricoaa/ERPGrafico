"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

/**
 * AuthGuard protects private routes by redirecting unauthenticated users to the login page.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const { isAuthenticated, isLoading } = useAuth()

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login")
        }
    }, [isLoading, isAuthenticated, router])

    // While loading or not authenticated, don't show children to prevent content flash
    if (isLoading || !isAuthenticated) {
        return null
    }

    return <>{children}</>
}
