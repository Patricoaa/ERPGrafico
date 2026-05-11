"use client"

import { CheckCircle2, LayoutDashboard, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import type { WorkOrder } from '../../types'

interface FinishedStepProps {
  order: WorkOrder
}

export function FinishedStep({ order }: FinishedStepProps) {
  const { openHub } = useHubPanel()
  const discrepancy = order.production_discrepancy

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-success/20 blur-2xl rounded-full scale-150 animate-pulse" />
        <div className="relative bg-success p-6 rounded-full shadow-lg shadow-success/20">
          <CheckCircle2 className="h-16 w-16 text-white" />
        </div>
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-2xl font-bold text-foreground">Producción Finalizada</h3>
        <p className="text-muted-foreground leading-relaxed">
          Este trabajo ha completado todas sus etapas y el producto final ha sido ingresado al inventario de despacho.
        </p>
      </div>

      {discrepancy && (
        <div className="w-full max-w-md p-4 rounded-md border border-warning/40 bg-warning/10 text-left flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-warning">Discrepancia de cantidad</p>
            <p className="text-xs text-muted-foreground">
              Se produjeron <span className="font-bold text-foreground">{discrepancy.produced}</span> unidades
              pero la nota de venta registra <span className="font-bold text-foreground">{discrepancy.sold}</span>.
              {' '}Delta: <span className={`font-bold ${discrepancy.delta > 0 ? 'text-success' : 'text-destructive'}`}>
                {discrepancy.delta > 0 ? '+' : ''}{discrepancy.delta}
              </span>.
            </p>
            <p className="text-xs text-muted-foreground">
              El vendedor debe revisar el pedido para ajustar la cantidad o emitir un complemento.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => order.sale_order?.id && openHub({ orderId: order.sale_order.id, type: 'sale' })}
          className="gap-2 font-semibold"
        >
          <LayoutDashboard className="h-4 w-4" />
          Ir al HUB de Venta
        </Button>
      </div>
    </div>
  )
}
