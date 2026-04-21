"use client"

import { useAuth } from "@/contexts/AuthContext"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { user, isLoading: loading } = useAuth()
  
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'Usuario'

  if (loading) {
    return (
      <div className="flex flex-col space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-40 w-full" />
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
