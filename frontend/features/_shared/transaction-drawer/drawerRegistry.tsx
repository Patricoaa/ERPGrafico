import React, { Suspense } from 'react'
import { SkeletonShell } from '@/components/shared'

export const DRAWER_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  sale_order: React.lazy(() => import('@/features/sales/components/SaleOrderDrawer').then(m => ({ default: m.SaleOrderDrawer }))),
  purchase_order: React.lazy(() => import('@/features/purchasing/components/PurchaseOrderDrawer').then(m => ({ default: m.PurchaseOrderDrawer }))),
  service_obligation: React.lazy(() => import('@/features/purchasing/components/PurchaseOrderDrawer').then(m => ({ default: m.PurchaseOrderDrawer }))),
  invoice: React.lazy(() => import('@/features/billing/components/InvoiceDrawer').then(m => ({ default: m.InvoiceDrawer }))),
  work_order: React.lazy(() => import('@/features/production/components/WorkOrderWizard').then(m => ({ default: m.WorkOrderWizard }))),
  sale_delivery: React.lazy(() => import('@/features/sales/components/SaleDeliveryDrawer').then(m => ({ default: m.SaleDeliveryDrawer }))),
  purchase_receipt: React.lazy(() => import('@/features/purchasing/components/PurchaseReceiptDrawer').then(m => ({ default: m.PurchaseReceiptDrawer }))),
  purchase_return: React.lazy(() => import('@/features/purchasing/components/PurchaseReturnDrawer').then(m => ({ default: m.PurchaseReturnDrawer }))),
  payment: React.lazy(() => import('@/features/treasury/components/PaymentDrawer').then(m => ({ default: m.PaymentDrawer }))),
  journal_entry: React.lazy(() => import('@/features/accounting/components/JournalEntryDrawer').then(m => ({ default: m.JournalEntryDrawer }))),
  cash_movement: React.lazy(() => import('@/features/treasury/components/CashMovementDrawer').then(m => ({ default: m.CashMovementDrawer }))),
  terminal_batch: React.lazy(() => import('@/features/treasury/components/TerminalBatchDrawer').then(m => ({ default: m.TerminalBatchDrawer }))),
  profit_distribution: React.lazy(() => import('@/features/settings/components/ProfitDistributionDrawer').then(m => ({ default: m.ProfitDistributionDrawer }))),
  stock_move: React.lazy(() => import('@/features/inventory/components/StockMoveDrawer').then(m => ({ default: m.StockMoveDrawer }))),
}

export function LazyDrawer({ type, open, onOpenChange, ...props }: {
  type: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  [key: string]: unknown
}) {
  const Drawer = DRAWER_MAP[type]
  if (!Drawer) return null
  return (
    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
      <Drawer open={open} onOpenChange={onOpenChange} {...props} />
    </Suspense>
  )
}
