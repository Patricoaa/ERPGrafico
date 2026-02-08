"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TerminalsPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/treasury/accounts?tab=terminals')
    }, [router])

    return (
        <div className="p-8">
            <p className="text-muted-foreground">Redirigiendo a gestión de terminales en Tesorería...</p>
        </div>
    )
}
