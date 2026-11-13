'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Users, Play, Wand2, Wallet, Trash2, FileText, Split, Download } from 'lucide-react'
import { Collection, useEntityCollection } from '@/components/entity-view'
import { formatCurrency } from '@/lib/money'
import { formatPlainDate } from '@/lib/utils'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { useProfitDistribution, useDownloadPeriodResult } from '../hooks'
import { DocumentSheet } from '@/features/documents'
import { Section, type DocumentActionItem } from '@/components/shared'
import { CreateDistributionWizard } from './CreateDistributionWizard'
import { MassPaymentWizard } from './MassPaymentWizard'
import { ProfitDistributionActionModal, type ProfitDistributionActionRequest } from './ProfitDistributionActionModal'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { distributionPartnerEntity, distributionLineToRow, documentPartnerViews } from '../entity-view/distributionPartner.entity'
import { distributionPartnerActions } from './distributionPartnerActions'

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
  const { setEntityDisplay, openEntity } = useGlobalModals()
  const [request, setRequest] = useState<ProfitDistributionActionRequest | null>(null)
  const [wizard, setWizard] = useState<'retake' | 'pay' | null>(null)
  const periodResult = useDownloadPeriodResult(entityId ?? 0, distribution?.fiscal_year)
  const displayId = distribution?.display_id ?? `#${entityId}`

  useEffect(() => {
    if (distribution?.id && distribution.display_id) {
      setEntityDisplay('contacts.profitdistributionresolution', distribution.id, distribution.display_id)
    }
  }, [distribution?.id, distribution?.display_id, setEntityDisplay])
  const isProfit = distribution?.is_profit !== false
  const lines = useMemo(() => distribution?.lines ?? [], [distribution?.lines])
  const rows = useMemo(() => lines.map(l => distributionLineToRow(l)), [lines])
  const collection = useEntityCollection(distributionPartnerEntity, { rows }, { pagination: { mode: "none" } })

  const destTotals = useMemo(() => rows.reduce(
    (acc, r) => ({ dividends: acc.dividends + r.dividend, reinvest: acc.reinvest + r.reinvest, retained: acc.retained + r.retained }),
    { dividends: 0, reinvest: 0, retained: 0 },
  ), [rows])
  const totalDistributed = rows.reduce((s, r) => s + r.net, 0)

  const offsetTotal = rows.reduce((s, r) => s + r.offset, 0)
  const offsetPartners = rows.filter(r => r.offset > 0).length

  const hasDividends = destTotals.dividends > 0
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
        context={[]}
        sections={distribution ? [
          {
            title: "Resultado",
            icon: FileText,
            content: (
              <Section>
                <Section.Row
                  variant="stat"
                  title={isProfit ? "Utilidad neta" : "Pérdida neta"}
                  value={formatCurrency(Number(distribution.net_result))}
                  valueClassName={isProfit ? "text-success" : "text-destructive"}
                  strong
                />
                <Section.Row variant="stat" plain title="Año fiscal" value={distribution.fiscal_year ? String(distribution.fiscal_year) : "—"} />
                <Section.Row variant="stat" plain title="Acta N°" value={distribution.acta_number || "—"} />
                <Section.Row variant="stat" plain title="Fecha" value={distribution.resolution_date ? formatPlainDate(distribution.resolution_date) : "—"} />
                {distribution.notes && <Section.Row variant="stat" plain title="Notas" value={distribution.notes} />}
                {distribution.result_snapshot_available && (
                  <Section.Row
                    title="Resultado del periodo"
                    description="Estado de resultados del ejercicio, tal como estaba al cerrarlo."
                    actions={<Section.Action text="Descargar PDF" icon={Download} onClick={() => void periodResult.download()} disabled={periodResult.isDownloading} />}
                  />
                )}
              </Section>
            ),
          },
          {
            title: "Destino del resultado",
            icon: Split,
            content: (
              <Section>
                {offsetTotal > 0 && (
                  <Section.Row
                    variant="stat"
                    title="Retiros provisorios absorbidos"
                    value={`${formatCurrency(offsetTotal)} · ${offsetPartners === 1 ? "1 socio" : `${offsetPartners} socios`}`}
                    valueClassName="text-warning"
                  />
                )}
                <Section.Row variant="stat" title="Dividendos" value={formatCurrency(destTotals.dividends)} />
                <Section.Row variant="stat" title="Reinversión" value={formatCurrency(destTotals.reinvest)} />
                <Section.Row variant="stat" title="Ut. Retenidas" value={formatCurrency(destTotals.retained)} />
                <Section.Row variant="total" title="Total distribuido" value={formatCurrency(totalDistributed)} />
              </Section>
            ),
          },
        ] : []}
        extraTabs={distribution ? [{
          value: 'detail',
          label: 'Detalle',
          icon: Users,
          content: (
            <section aria-label="Detalle de destino" className="space-y-4">
              <Section.Header spaced title="Detalle de destino" icon={Users} />
              <Collection.Root
                collection={collection}
                label="Detalle de destino"
                onOpen={(row) => { if (row.partnerId) openEntity("contacts.partner", row.partnerId) }}
                actions={distributionPartnerActions.forCollection({
                  onViewPartner: (partnerId) => openEntity("contacts.partner", partnerId),
                  onPayDividends: distribution.status === 'EXECUTED' && hasDividends ? () => setWizard('pay') : undefined,
                })}
              >
                <Collection.View table={documentPartnerViews.table} emptyTitle="Sin socios" emptyDescription="La distribución no tiene líneas." />
              </Collection.Root>
            </section>
          ),
        }] : []}
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
