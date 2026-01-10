"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DollarSign, CreditCard, Activity, Users, Loader2, ArrowUpRight, ShoppingCart, Factory, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface DashboardMetrics {
  total_sales: number
  accounts_receivable: number
  sales_count: number
  total_purchases: number
  accounts_payable: number
  pending_purchases: number
  active_production: number
  stockouts: number
  recent_activity: any[]
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/core/dashboard/metrics/')
      setMetrics(res.data)
    } catch (error) {
      console.error("Error fetching metrics", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Panel de Control</h2>
      </div>

      {/* Row 1: Financial Overview */}
      <h3 className="text-lg font-semibold text-muted-foreground mt-2">Resumen Financiero</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.total_sales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Ingresos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compras Totales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.total_purchases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Egresos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas por Cobrar</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.accounts_receivable.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Saldo pendiente de clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas por Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.accounts_payable.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Saldo pendiente a proveedores</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Operational Overview */}
      <h3 className="text-lg font-semibold text-muted-foreground mt-6">Operaciones</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Producción Activa</CardTitle>
            <Factory className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active_production}</div>
            <p className="text-xs text-muted-foreground">Órdenes en proceso/planificadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compras Pendientes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pending_purchases}</div>
            <p className="text-xs text-muted-foreground">Órdenes por recibir</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.stockouts}</div>
            <p className="text-xs text-muted-foreground">Productos sin stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Realizadas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{metrics?.sales_count}</div>
            <p className="text-xs text-muted-foreground">Total órdenes de venta</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Activity & Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimos movimientos contables registrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.recent_activity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.date} - Ref: {entry.reference || 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={entry.state === 'POSTED' ? 'success' : 'outline'}>
                      {entry.state === 'POSTED' ? 'Publicado' : 'Borrador'}
                    </Badge>
                    <span className="text-xs font-mono">{entry.number}</span>
                  </div>
                </div>
              ))}
              {metrics?.recent_activity.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No hay actividad registrada recientemente.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">Acciones frecuentes recomendadas:</p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => window.location.href = '/sales/pos'} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted transition-colors text-sm">
                <span>Punto de Venta (POS)</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button onClick={() => window.location.href = '/sales/orders'} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted transition-colors text-sm">
                <span>Notas de Venta</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button onClick={() => window.location.href = '/purchasing/orders'} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted transition-colors text-sm">
                <span>Ordenes de Compra</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button onClick={() => window.location.href = '/production/orders'} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted transition-colors text-sm">
                <span>Ordenes de Trabajo</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}