'use client'

import React from 'react'
import { Drawer, StatusBadge, SkeletonShell } from '@/components/shared'
import { useDrawerIdentity, usePrintableDrawer } from "@/features/_shared/drawer"
import { formatCurrency } from '@/lib/money'
import { PrintableLayout } from '@/features/_shared'
import { useProfitDistribution } from '@/features/contacts'
import type { TransactionDrawerProps } from '@/features/_shared'
import { formDrawerWidth } from '@/lib/form-widths'

interface ProfitDistributionDrawerProps extends TransactionDrawerProps {
  distributionId?: number
}

export function ProfitDistributionDrawer({ id, open, onOpenChange, distributionId }: ProfitDistributionDrawerProps) {
  const entityId = id ?? distributionId ?? null
  const { data: distribution, isLoading } = useProfitDistribution(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()

  const displayId = distribution?.display_id ?? `#${entityId}`
  const isProfit = distribution?.is_profit !== false
  const identity = useDrawerIdentity('contacts.profitdistributionresolution', 'view', distribution, {
    overrideSubtitle: isProfit ? 'Utilidad' : 'Pérdida',
    onPrint: handlePrint,
  })

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
        mode="view"
        open={open}
        onOpenChange={onOpenChange}
        side="left"
        defaultSize={formDrawerWidth("master", false)}
        icon={identity.icon}
        title={identity.title}
        headerActions={identity.headerActions}
        subtitle={identity.subtitle}
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
