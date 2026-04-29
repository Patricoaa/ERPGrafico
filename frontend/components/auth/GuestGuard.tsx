"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

/**
 * GuestGuard redirects authenticated users away from public-only pages (like /login)
 * to the dashboard.
 */
export default function GuestGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const { isAuthenticated, isLoading } = useAuth()

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.push("/")
        }
    }, [isLoading, isAuthenticated, router])

    // While loading or authenticated, don't show children to prevent content flash
    // We don't show children if authenticated because they are about to be redirected
    if (isLoading || isAuthenticated) {
        return null
    }

    return <>{children}</>
}
