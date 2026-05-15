"use client"

import { useAuth } from "@/contexts/AuthContext"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/shared"
import Link from "next/link"
import { Calculator, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, Receipt, UserCog, Users } from "lucide-react"
import { ProductionMetricsCard } from "@/features/production/components/ProductionMetricsCard"

const modules = [
  { id: "accounting", icon: Calculator, label: "Contabilidad", url: "/accounting", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "billing", icon: Receipt, label: "Facturación", url: "/billing", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "sales", icon: ShoppingCart, label: "Ventas", url: "/sales", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "contacts", icon: Users, label: "Contactos", url: "/contacts", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "inventory", icon: Package, label: "Inventario", url: "/inventory", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "production", icon: Printer, label: "Producción", url: "/production", status: "Pendiente", statusColor: "text-warning bg-warning/10" },
  { id: "treasury", icon: Banknote, label: "Tesorería", url: "/treasury", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "purchasing", icon: ShoppingBag, label: "Compras", url: "/purchasing", status: "Online", statusColor: "text-success bg-success/10" },
  { id: "finances", icon: PieChart, label: "Finanzas", url: "/finances", status: "Offline", statusColor: "text-muted-foreground bg-muted" },
  { id: "hr", icon: UserCog, label: "RRHH", url: "/hr", status: "Offline", statusColor: "text-muted-foreground bg-muted" },
]

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-8">
      <PageHeader 
        title="Dashboard" 
        description={`Bienvenido de nuevo, ${displayName}. Selecciona un módulo para comenzar.`}
        iconName="home"
      />
      
      <ProductionMetricsCard />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod, index) => {
          const Icon = mod.icon
          return (
            <Link 
              key={mod.id} 
              href={mod.url}
              className="group relative flex flex-col justify-between p-5 h-28 bg-background border border-border/10 rounded-xl shadow-sm hover:shadow-md hover:border-border/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold tracking-tight text-sm text-foreground">{mod.label}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-auto">
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${mod.statusColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {mod.status}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
