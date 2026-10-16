'use client'

import React from 'react'
import { DataCell } from '@/components/shared'
import { formatCurrency } from '@/lib/money'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { DocumentSheet, SHEET_LEFT } from '@/features/documents'
import { useTerminalBatch } from '@/features/treasury/hooks/useTerminalBatch'

interface TerminalBatchDrawerProps extends TransactionDrawerProps {
  batchId?: number
}

/**
 * Ficha documental del lote de terminal (ADR-0083): contexto (bruto, neto a depositar,
 * proveedor y medio, período, notas) + relaciones (cobros incluidos, depósito, factura del
 * proveedor).
 */
export function TerminalBatchDrawer({ id, open, onOpenChange, batchId }: TerminalBatchDrawerProps) {
  const entityId = id ?? batchId ?? null
  const { data: batch, isLoading, isError } = useTerminalBatch(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()
  const displayId = batch?.display_id ?? `#${entityId}`

  return (
    <>
      <PrintableLayout ref={printRef} title="Lote de Terminal" displayId={displayId}>
        <div className="text-4xs space-y-1 mb-2">
          <div className="flex justify-between"><span>Bruto:</span><span>{formatCurrency(Number(batch?.gross_amount ?? 0))}</span></div>
          <div className="flex justify-between"><span>Comisiones:</span><span>-{formatCurrency(Number(batch?.commission_total ?? batch?.commission_tax ?? 0))}</span></div>
          <div className="flex justify-between font-bold pt-1 border-t mt-1"><span>Neto:</span><span>{formatCurrency(Number(batch?.net_amount ?? 0))}</span></div>
        </div>
      </PrintableLayout>

      <DocumentSheet
        label="treasury.terminalbatch"
        auditType="terminal_batch"
        open={open}
        onOpenChange={onOpenChange}
        document={batch ?? null}
        isLoading={isLoading}
        error={isError ? new Error("No se pudo cargar el lote.") : undefined}
        loadingLabel="Cargando lote de terminal"
        status={batch?.status ?? null}
        onPrint={handlePrint}
        context={batch ? [
          { label: "Monto bruto", value: <span className="tabular-nums">{formatCurrency(Number(batch.gross_amount))}</span> },
          { label: "Neto a depositar", value: <span className="font-bold tabular-nums text-income">{formatCurrency(Number(batch.net_amount))}</span> },
          { label: "Proveedor · medio", value: [batch.provider_name ?? batch.provider, batch.payment_method].filter(Boolean).join(' · ') || null },
          {
            label: "Período",
            value: (
              <span className="inline-flex items-center gap-1">
                <DataCell.Date value={batch.sales_date} size="xs" className={SHEET_LEFT} />
                <span aria-hidden>→</span>
                <DataCell.Date value={batch.sales_date_end ?? batch.sales_date} size="xs" className={SHEET_LEFT} />
              </span>
            ),
          },
          { label: "Notas", value: batch.notes || null, span: 4, hidden: !batch.notes },
        ] : []}
      />
    </>
  )
}
