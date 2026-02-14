"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { isAuthenticated, isLoading } = useAuth()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        // Allow access to login page without token
        if (pathname === "/login") {
            setAuthorized(true)
            return
        }

        if (!isLoading) {
            if (!isAuthenticated) {
                setAuthorized(false)
                router.push("/login")
            } else {
                setAuthorized(true)
            }
        }
    }, [pathname, isAuthenticated, isLoading, router])

    if (!authorized) {
        return null;
    }

    return (
        <>
            {children}
        </>
    )
}
