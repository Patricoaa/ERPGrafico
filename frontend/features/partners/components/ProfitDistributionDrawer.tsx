'use client'

import React, { useEffect, useState } from 'react'
import { Users, Play, Wand2, Wallet, Trash2 } from 'lucide-react'
import { Collection, useEntityCollection } from '@/components/entity-view'
import { formatCurrency } from '@/lib/money'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { useProfitDistribution } from '../hooks'
import { DocumentSheet } from '@/features/documents'
import type { DocumentActionItem } from '@/components/shared'
import { CreateDistributionWizard } from './CreateDistributionWizard'
import { MassPaymentWizard } from './MassPaymentWizard'
import { ProfitDistributionActionModal, type ProfitDistributionActionRequest } from './ProfitDistributionActionModal'
import { useGlobalModalActions } from '@/components/providers/GlobalModalProvider'
import { profitDistributionLineEntity, profitDistributionLineViews, type ProfitDistributionLine } from '../entity-view/profitDistributionLine.entity'

interface ProfitDistributionDrawerProps extends TransactionDrawerProps {
  distributionId?: number
}

/**
 * Ficha documental de la distribución de resultados (ADR-0083): contexto (resultado, año
 * fiscal, acta, notas) + socios + relaciones (asiento, movimientos de socios).
 */
export function ProfitDistributionDrawer({ id, open, onOpenChange, distributionId }: ProfitDistributionDrawerProps) {
  const entityId = id ?? distributionId ?? null
  const { profitDistribution: distribution, isLoading } = useProfitDistribution(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()
  const { setEntityDisplay } = useGlobalModalActions()
  const [request, setRequest] = useState<ProfitDistributionActionRequest | null>(null)
  const [wizard, setWizard] = useState<'retake' | 'pay' | null>(null)
  const displayId = distribution?.display_id ?? `#${entityId}`

  useEffect(() => {
    if (distribution?.id && distribution.display_id) {
      setEntityDisplay('contacts.profitdistributionresolution', distribution.id, distribution.display_id)
    }
  }, [distribution?.id, distribution?.display_id, setEntityDisplay])
  const isProfit = distribution?.is_profit !== false
  const lines = (distribution?.lines as ProfitDistributionLine[] | undefined) ?? []
  const collection = useEntityCollection(profitDistributionLineEntity, { rows: lines }, { pagination: { mode: "none" } })

  const hasDividends = !!distribution?.lines?.some((l) => l.destinations?.some((d) => d.destination === 'DIVIDEND') || l.destination === 'DIVIDEND')
  let primaryAction: DocumentActionItem | null = null
  const actions: DocumentActionItem[] = []
  if (distribution) {
    if (distribution.status === 'DRAFT') {
      primaryAction = { id: 'retake', label: 'Retomar proceso', icon: Wand2, onClick: () => setWizard('retake') }
    } else if (distribution.status === 'APPROVED') {
      primaryAction = { id: 'execute', label: 'Ejecutar contablemente', icon: Play, onClick: () => setRequest({ kind: 'execute', distribution }) }
    } else if (distribution.status === 'EXECUTED' && hasDividends) {
      primaryAction = { id: 'pay', label: 'Pagar dividendos', icon: Wallet, onClick: () => setWizard('pay') }
    }
    if (distribution.status === 'DRAFT' || distribution.status === 'APPROVED') {
      actions.push({ id: 'delete', label: 'Eliminar borrador', icon: Trash2, destructive: true, onClick: () => setRequest({ kind: 'delete', distribution }) })
    }
  }

  return (
    <>
      <PrintableLayout ref={printRef} title="Distribución de Resultados" displayId={displayId}>
        <div className="text-4xs space-y-1 mb-2">
          <div className="flex justify-between"><span>Resultado:</span><span>{formatCurrency(Number(distribution?.net_result ?? 0))}</span></div>
        </div>
        {lines.map((line, idx) => (
          <div key={(line.id as number) ?? idx} className="flex justify-between text-3xs">
            <span className="flex-1">{line.partner_name as string}</span>
            <span className="w-16 text-right">{formatCurrency(Number(line.net_amount))}</span>
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
        primaryAction={primaryAction}
        actions={actions}
        onPrint={handlePrint}
        drawerSize="100%"
        context={distribution ? [
          {
            label: isProfit ? "Utilidad neta" : "Pérdida neta",
            value: <span className={`font-bold tabular-nums ${isProfit ? 'text-success' : 'text-destructive'}`}>{formatCurrency(Number(distribution.net_result))}</span>,
          },
          { label: "Año fiscal", value: distribution.fiscal_year ? String(distribution.fiscal_year) : null },
          { label: "Acta N°", value: distribution.acta_number ? String(distribution.acta_number) : null },
          { label: "Total distribuido", value: <span className="tabular-nums">{formatCurrency(lines.reduce((s, l) => s + Number(l.net_amount ?? 0), 0))}</span> },
          { label: "Notas", value: distribution.notes || null, span: 4, hidden: !distribution.notes },
        ] : []}
        sections={[{
          title: "Socios",
          icon: Users,
          content: (
            <Collection.Root collection={collection} label="Socios">
              <Collection.View table={profitDistributionLineViews.table} emptyTitle="Sin socios" emptyDescription="La distribución no tiene líneas." />
            </Collection.Root>
          ),
        }]}
      />

      <ProfitDistributionActionModal
        request={request}
        onClose={() => setRequest(null)}
        onDeleted={() => onOpenChange(false)}
      />
      {distribution && wizard === 'retake' && (
        <CreateDistributionWizard open onOpenChange={(v) => { if (!v) setWizard(null) }} initialResolution={distribution} />
      )}
      {distribution && wizard === 'pay' && (
        <MassPaymentWizard open onOpenChange={(v) => { if (!v) setWizard(null) }} resolution={distribution} />
      )}
    </>
  )
}
