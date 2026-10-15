'use client'

import React from 'react'
import { DataCell } from '@/components/shared'
import { formatCurrency } from '@/lib/money'
import { PrintableLayout, usePrintableDrawer, type TransactionDrawerProps } from '@/features/_shared'
import { DocumentSheet, SHEET_LEFT } from '@/features/documents'
import { useTreasuryMovement } from '@/features/treasury/hooks/useTreasuryMovement'

interface CashMovementDrawerProps extends TransactionDrawerProps {
  movementId?: number
}

/**
 * Ficha documental del movimiento de tesorería (pago, cobro, traspaso — ADR-0083): contexto
 * (monto, medio de pago, origen → destino, fecha, referencia y notas) + relaciones
 * (documentos que paga/cobra, asiento, cheque o lote).
 */
export function CashMovementDrawer({ id, open, onOpenChange, movementId }: CashMovementDrawerProps) {
  const entityId = id ?? movementId ?? null
  const { data: movement, isLoading, isError } = useTreasuryMovement(entityId)
  const { printRef, handlePrint } = usePrintableDrawer()
  const displayId = movement?.display_id ?? `#${entityId}`
  const movementType = movement?.movement_type_display ?? movement?.movement_type ?? ''
  const from = movement?.from_container_name ?? movement?.from_account_name ?? null
  const to = movement?.to_container_name ?? movement?.to_account_name ?? null
  const isOutbound = movement?.movement_type === 'OUTBOUND'

  return (
    <>
      <PrintableLayout ref={printRef} title="Movimiento de Tesorería" displayId={displayId} subtitle={movementType}>
        <div className="text-4xs space-y-1 mb-2">
          <div className="flex justify-between"><span>Origen:</span><span>{from ?? '-'}</span></div>
          <div className="flex justify-between"><span>Destino:</span><span>{to ?? '-'}</span></div>
          <div className="flex justify-between font-bold pt-1 border-t mt-1">
            <span>Monto:</span><span>{formatCurrency(Number(movement?.amount ?? 0))}</span>
          </div>
        </div>
      </PrintableLayout>

      <DocumentSheet
        label="treasury.treasurymovement"
        open={open}
        onOpenChange={onOpenChange}
        document={movement ?? null}
        isLoading={isLoading}
        error={isError ? new Error("No se pudo cargar el movimiento.") : undefined}
        loadingLabel="Cargando movimiento"
        status={movement?.status ?? null}
        onPrint={handlePrint}
        auditType="payment"
        context={movement ? [
          {
            label: "Monto",
            value: (
              <span className={`font-bold tabular-nums ${isOutbound ? 'text-expense' : 'text-income'}`}>
                {isOutbound ? '-' : '+'}{formatCurrency(Number(movement.amount))}
              </span>
            ),
          },
          { label: "Medio de pago", value: [movementType, movement.payment_method_display ?? movement.payment_method].filter(Boolean).join(' · ') || null },
          { label: "Origen → destino", value: from || to ? `${from ?? '—'} → ${to ?? '—'}` : null },
          { label: "Fecha", value: movement.date ? <DataCell.Date value={String(movement.date)} size="xs" className={SHEET_LEFT} /> : null },
          { label: "Referencia", value: movement.reference || null },
          { label: "Notas", value: movement.notes || movement.justify_reason || null, span: 3 },
        ] : []}
      />
    </>
  )
}
