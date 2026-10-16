'use client'

import React, { useMemo } from 'react'
import { Users } from 'lucide-react'
import { DataTable } from '@/components/shared'
import { formatCurrency } from '@/lib/money'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { useProfitDistribution } from '@/features/contacts'
import { DocumentSheet } from '@/features/documents'
import { profitDistributionLineFields } from '../profitDistributionLineFields'

interface ProfitDistributionDrawerProps extends TransactionDrawerProps {
  distributionId?: number
}

type Row = Record<string, unknown>

/**
 * Ficha documental de la distribución de resultados (ADR-0083): contexto (resultado, año
 * fiscal, acta, notas) + socios + relaciones (asiento, movimientos de socios).
 */
export function ProfitDistributionDrawer({ id, open, onOpenChange, distributionId }: ProfitDistributionDrawerProps) {
  const entityId = id ?? distributionId ?? null
  const { profitDistribution: distribution, isLoading } = useProfitDistribution(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()
  const columns = useMemo(() => profitDistributionLineFields.toColumns(), [])
  const displayId = distribution?.display_id ?? `#${entityId}`
  const isProfit = distribution?.is_profit !== false
  const lines = (distribution?.lines as Row[] | undefined) ?? []

  return (
    <>
      <PrintableLayout ref={printRef} title="Distribución de Resultados" displayId={displayId}>
        <div className="text-4xs space-y-1 mb-2">
          <div className="flex justify-between"><span>Resultado:</span><span>{formatCurrency(Number(distribution?.net_result ?? 0))}</span></div>
        </div>
        {lines.map((line, idx) => (
          <div key={(line.id as number) ?? idx} className="flex justify-between text-3xs">
            <span className="flex-1">{line.partner_name as string}</span>
            <span className="w-16 text-right">{formatCurrency(Number(line.net_amount as string))}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
          <span>Total Distribuido</span>
          <span>{formatCurrency(lines.reduce((s, l) => s + Number(l.net_amount ?? 0), 0))}</span>
        </div>
      </PrintableLayout>

      <DocumentSheet
        label="contacts.profitdistributionresolution"
        auditType="profit_distribution"
        open={open}
        onOpenChange={onOpenChange}
        document={distribution ? { id: Number(distribution.id), display_id: distribution.display_id } : null}
        isLoading={isLoading}
        error={!isLoading && !distribution && entityId ? new Error("No se pudo cargar la distribución.") : undefined}
        loadingLabel="Cargando distribución"
        status={distribution?.status ?? null}
        onPrint={handlePrint}
        context={distribution ? [
          {
            label: isProfit ? "Utilidad neta" : "Pérdida neta",
            value: <span className={`font-bold tabular-nums ${isProfit ? 'text-success' : 'text-destructive'}`}>{formatCurrency(Number(distribution.net_result))}</span>,
          },
          { label: "Año fiscal", value: String(distribution.fiscal_year_obj ?? distribution.fiscal_year ?? '') || null },
          { label: "Acta N°", value: distribution.acta_number ? String(distribution.acta_number) : null },
          { label: "Total distribuido", value: <span className="tabular-nums">{formatCurrency(lines.reduce((s, l) => s + Number(l.net_amount ?? 0), 0))}</span> },
          { label: "Notas", value: distribution.notes || null, span: 4, hidden: !distribution.notes },
        ] : []}
        sections={[{
          title: "Socios",
          icon: Users,
          content: (
            <DataTable
              columns={columns}
              data={lines}
              variant="minimal"
              hidePagination
              emptyState={{ title: "Sin socios", description: "La distribución no tiene líneas." }}
            />
          ),
        }]}
      />
    </>
  )
}
