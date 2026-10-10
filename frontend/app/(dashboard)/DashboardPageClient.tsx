"use client"

import { useAuth } from "@/contexts/AuthContext"

import { ModuleGrid, PageContainer, PageHeader, Skeleton, type ModuleGridItem } from '@/components/shared'
import { Calculator, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, Receipt, UserCog, Users } from "lucide-react"
import { ProductionMetricsCard } from "@/features/production"

const modules: ModuleGridItem[] = [
  { id: "accounting", icon: Calculator, label: "Contabilidad", url: "/accounting" },
  { id: "billing", icon: Receipt, label: "Facturación", url: "/billing" },
  { id: "sales", icon: ShoppingCart, label: "Ventas", url: "/sales" },
  { id: "contacts", icon: Users, label: "Contactos", url: "/contacts" },
  { id: "inventory", icon: Package, label: "Inventario", url: "/inventory" },
  { id: "production", icon: Printer, label: "Producción", url: "/production" },
  { id: "treasury", icon: Banknote, label: "Tesorería", url: "/treasury" },
  { id: "purchasing", icon: ShoppingBag, label: "Compras", url: "/purchasing" },
  { id: "finances", icon: PieChart, label: "Finanzas", url: "/finances" },
  { id: "hr", icon: UserCog, label: "RRHH", url: "/hr" },
]

export default function DashboardPageClient() {
  const { user, isLoading: loading } = useAuth()
  
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'Usuario'

  if (loading) {
    return (
      <PageContainer className="space-y-8" animate={false}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Array(n) spread is a common React skeleton pattern */}
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      </PageContainer>
    )
  }

  const navigation = {
    moduleName: "Inicio",
    moduleHref: "/",
    tabs: [],
    activeValue: "dashboard",
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader 
        title="Dashboard" 
        description={`Bienvenido de nuevo, ${displayName}. Selecciona un módulo para comenzar.`}
        iconName="home"
        navigation={navigation}
      />
      
      <ProductionMetricsCard />
      
      <ModuleGrid items={modules} />
    </PageContainer>
  )
}