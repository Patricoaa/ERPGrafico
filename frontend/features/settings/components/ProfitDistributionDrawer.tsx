'use client'

import React, { useRef, type ReactNode } from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Printer, ChartPie } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout } from '@/features/_shared/transaction-drawer'
import { useProfitDistribution } from '@/features/contacts/hooks/useProfitDistribution'
import type { TransactionDrawerProps } from '@/features/_shared/transaction-drawer'

interface ProfitDistributionDrawerProps extends TransactionDrawerProps {
  distributionId?: number
}

export function ProfitDistributionDrawer({ id, open, onOpenChange, distributionId }: ProfitDistributionDrawerProps) {
  const entityId = id ?? distributionId ?? null
  const { data: distribution, isLoading } = useProfitDistribution(entityId)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const displayId = distribution?.display_id ?? `#${entityId}`
  const isProfit = distribution?.is_profit !== false

  return (
    <>
      <PrintableLayout
        ref={printRef}
        title="Distribución de Resultados"
        displayId={displayId}
      >
        <div className="text-[9px] space-y-1 mb-2">
          <div className="flex justify-between">
            <span>Resultado:</span>
            <span>{formatCurrency(Number(distribution?.net_result ?? 0))}</span>
          </div>
        </div>
        {distribution?.lines?.map((line: Record<string, unknown>, idx: number) => (
          <div key={(line.id as number) ?? idx} className="flex justify-between text-[10px]">
            <span className="flex-1">{line.partner_name as string}</span>
            <span className="w-16 text-right">{formatCurrency(Number(line.net_amount as string))}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
          <span>Total Distribuido</span>
          <span>
            {formatCurrency(
              distribution?.lines?.reduce((s: number, l: Record<string, unknown>) => s + Number(l.net_amount ?? 0), 0) ?? 0,
            )}
          </span>
        </div>
      </PrintableLayout>

      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize="55%"
        icon={ChartPie}
        title={<span>{displayId}</span>}
        headerActions={<Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
        subtitle={isProfit ? 'Utilidad' : 'Pérdida'}
        description={`Ejercicio ${distribution?.fiscal_year ?? ''} · ${formatPlainDate(distribution?.resolution_date)}`}

      >
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando distribución">
          {distribution && (
            <div className="p-4 space-y-4">
              <StatusBadge status={distribution.status} />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Resultado Neto</span>
                  <p className={`font-bold text-lg ${isProfit ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(Number(distribution.net_result))}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Año Fiscal</span>
                  <p className="font-medium">{distribution.fiscal_year_obj ?? distribution.fiscal_year ?? '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Acta N°</span>
                  <p className="font-medium">{distribution.acta_number ?? '-'}</p>
                </div>
                {distribution.notes && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Notas</span>
                    <p className="text-sm">{distribution.notes}</p>
                  </div>
                )}
              </div>

              {distribution.lines && distribution.lines.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold mb-2">Socios / Accionistas</h4>
                  <div className="space-y-2">
                    {distribution.lines.map((line: Record<string, unknown>, idx: number) => (
                      <div key={line.id as number ?? idx} className="flex justify-between items-center text-sm border-b pb-2">
                        <div>
                          <p className="font-medium">{line.partner_name as string}</p>
                          <p className="text-xs text-muted-foreground">
                            {parseFloat(String(line.percentage_at_date as string)).toFixed(2)}% ·{' '}
                            {(line.destination as string) === 'DIVIDEND' ? 'Dividendo' :
                              (line.destination as string) === 'REINVEST' ? 'Reinversión' :
                                (line.destination as string) === 'RETAINED' ? 'Retenida' : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(line.net_amount as string))}</p>
                          {Number(line.provisional_withdrawals_offset as string) > 0 && (
                            <p className="text-xs text-destructive">
                              -{formatCurrency(Number(line.provisional_withdrawals_offset as string))}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SkeletonShell>
      </Drawer>
    </>
  )
}
