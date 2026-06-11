'use client'

import React, { useRef } from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer, Layers } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import { useTerminalBatch } from '@/features/treasury/hooks/useTerminalBatch'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface TerminalBatchDrawerProps extends TransactionDrawerProps {
  batchId?: number
}

export function TerminalBatchDrawer({ id, open, onOpenChange, batchId }: TerminalBatchDrawerProps) {
  const entityId = id ?? batchId ?? null
  const { data: batch, isLoading } = useTerminalBatch(entityId)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const displayId = batch?.display_id ?? `#${entityId}`

  return (
    <>
      <PrintableLayout
        ref={printRef}
        title="Lote de Terminal"
        displayId={displayId}
      >
        <div className="text-[9px] space-y-1 mb-2">
          <div className="flex justify-between">
            <span>Bruto:</span>
            <span>{formatCurrency(Number(batch?.gross_amount ?? 0))}</span>
          </div>
          <div className="flex justify-between">
            <span>Comisiones:</span>
            <span>-{formatCurrency(Number(batch?.commission_total ?? batch?.commission_tax ?? 0))}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t mt-1">
            <span>Neto:</span>
            <span>{formatCurrency(Number(batch?.net_amount ?? 0))}</span>
          </div>
        </div>
      </PrintableLayout>

      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize="50%"
        icon={Layers}
        title={<span>{displayId}</span>}
        headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
        subtitle="Lote de Liquidación"
        description={batch?.provider_name ?? batch?.payment_method ?? ''}

      >
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando lote de terminal">
          {batch && (
            <div className="p-4 space-y-4">
              <StatusBadge status={batch.status} />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Monto Bruto</span>
                  <p className="font-bold text-lg">{formatCurrency(Number(batch.gross_amount))}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Neto a Depositar</span>
                  <p className="font-bold text-lg text-income">{formatCurrency(Number(batch.net_amount))}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Proveedor</span>
                  <p className="font-medium">{batch.provider_name ?? batch.provider ?? '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Método de Pago</span>
                  <p className="font-medium">{batch.payment_method ?? '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Período</span>
                  <p className="text-sm">
                    {formatPlainDate(batch.sales_date)} — {formatPlainDate(batch.sales_date_end ?? batch.sales_date)}
                  </p>
                </div>
                {batch.notes && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Notas</span>
                    <p className="text-sm italic">{batch.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SkeletonShell>
      </Drawer>
    </>
  )
}
