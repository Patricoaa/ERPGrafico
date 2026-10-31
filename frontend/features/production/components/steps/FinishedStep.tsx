"use client"

import type { ReactNode } from 'react'
import {CheckCircle2, AlertTriangle, Copy} from 'lucide-react'
import { SubmitButton, StepHeader, CardSurface } from "@/components/shared"
import type { WorkOrder } from '../../types'
import { getDomainConceptTitle } from "@/lib/entity-registry"

interface FinishedStepProps {
  order: WorkOrder
  onUploadPhoto?: (file: File) => Promise<void>
  isUploadingPhoto?: boolean
  onPrintCopy?: () => Promise<void>
  isDuplicating?: boolean
  headerActions?: ReactNode
}

export function FinishedStep({ order, onPrintCopy, isDuplicating, headerActions }: FinishedStepProps) {
  const discrepancy = order.production_discrepancy

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StepHeader
        title="Producción Finalizada"
        description="Todos los materiales han sido consumidos y el producto está listo."
        icon={CheckCircle2}
        rightContent={headerActions}
      />
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-success/20 blur-2xl rounded-full scale-150 animate-pulse" />
        <div className="relative bg-success p-6 rounded-full shadow-elevated shadow-success/20">
          <CheckCircle2 className="h-16 w-16 text-success-foreground" />
        </div>
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-2xl font-bold text-foreground">Producción Finalizada</h3>
        <p className="text-muted-foreground leading-relaxed">
          Este trabajo ha completado todas sus etapas y el producto final ha sido ingresado al inventario de despacho.
        </p>
      </div>

      {order.production_outcome && (
        <CardSurface className="w-full max-w-md space-y-3 p-4 text-left">
          {order.production_outcome.warehouse_name && (
            <p className="text-sm font-semibold text-foreground">
              Ingresó a {order.production_outcome.warehouse_name}
            </p>
          )}
          {order.production_outcome.kind === "STOCK" && order.production_outcome.stocked && (
            <p className="text-xs text-muted-foreground">Disponible para la venta</p>
          )}
          {order.production_outcome.stocked === false && (
            <p className="text-xs text-muted-foreground">Sin ingreso a inventario</p>
          )}
          {order.production_outcome.delivery && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                {order.production_outcome.delivery.status === "DELIVERED"
                  ? "Entregado al cliente"
                  : "Esperando entrega al cliente"}
              </p>
              <div
                role="progressbar"
                aria-label="Avance de entrega"
                aria-valuenow={Math.round(
                  (order.production_outcome.delivery.delivered / order.production_outcome.delivery.ordered) * 100
                )}
                className="h-2 w-full rounded-full bg-muted overflow-hidden"
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (order.production_outcome.delivery.delivered / order.production_outcome.delivery.ordered) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </CardSurface>
      )}

      {discrepancy && (
        <div className="w-full max-w-md p-4 rounded-md border border-warning/40 bg-warning/10 text-left flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-warning">Discrepancia de cantidad</p>
            <p className="text-xs text-muted-foreground">
              Se produjeron <span className="font-bold text-foreground">{discrepancy.produced}</span> unidades
              pero la {getDomainConceptTitle('ov').toLowerCase()} registra <span className="font-bold text-foreground">{discrepancy.sold}</span>.
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

      <div className="flex gap-3 flex-wrap justify-center">

        {onPrintCopy && (
          <SubmitButton className="gap-2" loading={isDuplicating} onClick={onPrintCopy} icon={Copy}>
            Duplicar OT
          </SubmitButton>
        )}

      </div>
    </div>
    </div>
  )
}
