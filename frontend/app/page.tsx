"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"

interface UserProfile {
  username: string
  first_name: string
  last_name: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await api.get('/core/auth/me/')
      setUser(res.data)
    } catch (error) {
      console.error("Error fetching user profile", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'Usuario'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <h1 className="text-4xl font-bold tracking-tight text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
        Bienvenido, {displayName}
      </h1>
      <p className="text-muted-foreground text-lg animate-in fade-in duration-1000 delay-300">
        Sistema de Gestión ERP Grafico
      </p>
    </div>
  )
}