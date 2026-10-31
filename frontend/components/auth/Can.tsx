"use client"
import React from "react"
import { useAuth } from "@/contexts/AuthContext"

interface CanProps {
    permission: string | null
    children: React.ReactNode
    fallback?: React.ReactNode
}

export function Can({ permission, children, fallback = null }: CanProps) {
    const { can } = useAuth()
    if (!permission) return <>{children}</>
    return can(permission) ? <>{children}</> : <>{fallback}</>
}
