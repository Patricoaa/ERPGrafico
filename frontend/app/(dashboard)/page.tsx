"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"

interface UserProfile {
  username: string
  first_name: string
  last_name: string
}

import { useAuth } from "@/contexts/AuthContext"
import { PageHeader } from "@/components/shared/PageHeader"

export default function DashboardPage() {
  const { user, isLoading: loading } = useAuth()
  
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'Usuario'

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-8">
      <PageHeader 
        title="Dashboard" 
        description={`Bienvenido de nuevo, ${displayName}. Aquí tienes un resumen de la actividad.`}
        iconName="home"
      />
      
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
          ERPGrafico
        </h1>
        <p className="text-muted-foreground text-lg animate-in fade-in duration-1000 delay-300 text-center">
          Selecciona una opción del menú lateral para comenzar.
        </p>
      </div>
    </div>
  )
}
