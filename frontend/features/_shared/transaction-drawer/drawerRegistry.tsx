import React from 'react'
import { ErrorBoundary } from '@/components/shared'
import { ENTITY_DRAWERS } from '@/lib/entity-drawers'
import { TYPE_TO_REGISTRY } from './types'

/**
 * `docType` legacy (snake_case) → label `app.model` de ENTITY_DRAWERS.
 * ADR-0080 (GAP-12): un único registro de fichas; `DRAWER_MAP` (registro paralelo que
 * abría despachos/recepciones como documentos de inventario y asientos/pagos en modo
 * creación) se retiró.
 */
const DOC_TYPE_LABELS: Record<string, string> = {
  ...TYPE_TO_REGISTRY,
  service_obligation: 'purchasing.purchaseorder',
  inventory_document: 'inventory.inventorydocument',
}

export function docTypeToLabel(type: string): string | undefined {
  return DOC_TYPE_LABELS[type]
}

/**
 * Renderiza la ficha registrada en ENTITY_DRAWERS para un `docType` legacy.
 * Preferir `openEntity(label, id)` (pila con "volver"); este componente queda para las
 * vistas que gestionan la apertura con estado local.
 */
export function LazyDrawer({ type, id, open, onOpenChange }: {
  type: string
  id?: number | string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  [key: string]: unknown
}) {
  const label = docTypeToLabel(type)
  const render = label ? ENTITY_DRAWERS[label] : undefined
  if (!render || id == null || id === '') return null
  return (
    <ErrorBoundary variant="inline">
      {render({ id: Number(id), open: !!open, onOpenChange: onOpenChange ?? (() => {}) })}
    </ErrorBoundary>
  )
}
