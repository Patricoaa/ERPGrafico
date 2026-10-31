"use client"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import React from "react"

interface ModuleGuardProps {
    permission: string | null
    children: React.ReactNode
}

export function ModuleGuard({ permission, children }: ModuleGuardProps) {
    const { can, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && permission && !can(permission)) {
            router.replace("/403")
        }
    }, [isLoading, permission, can, router])

    if (isLoading) return null
    return <>{children}</>
}
