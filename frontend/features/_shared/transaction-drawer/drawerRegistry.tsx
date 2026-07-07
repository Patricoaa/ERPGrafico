import React, { Suspense } from 'react'
import { SkeletonShell, ErrorBoundary } from '@/components/shared'

type AnyDrawerComponent = React.ComponentType<Record<string, unknown>>

export const DRAWER_MAP: Record<string, React.LazyExoticComponent<AnyDrawerComponent>> = {
  sale_order: React.lazy(() => import('@/features/sales/components/SaleOrderDrawer').then(m => ({ default: m.SaleOrderDrawer as unknown as AnyDrawerComponent }))),
  purchase_order: React.lazy(() => import('@/features/purchasing/components/PurchaseOrderDrawer').then(m => ({ default: m.PurchaseOrderDrawer as unknown as AnyDrawerComponent }))),
  service_obligation: React.lazy(() => import('@/features/purchasing/components/PurchaseOrderDrawer').then(m => ({ default: m.PurchaseOrderDrawer as unknown as AnyDrawerComponent }))),
  invoice: React.lazy(() => import('@/features/billing/components/InvoiceDrawer').then(m => ({ default: m.InvoiceDrawer as unknown as AnyDrawerComponent }))),
  work_order: React.lazy(() => import('@/features/production/components/WorkOrderWizard').then(m => ({ default: m.WorkOrderWizard as unknown as AnyDrawerComponent }))),
  sale_delivery: React.lazy(() => import('@/features/sales/components/SaleDeliveryDrawer').then(m => ({ default: m.SaleDeliveryDrawer as unknown as AnyDrawerComponent }))),
  purchase_receipt: React.lazy(() => import('@/features/purchasing/components/PurchaseReceiptDrawer').then(m => ({ default: m.PurchaseReceiptDrawer as unknown as AnyDrawerComponent }))),
  purchase_return: React.lazy(() => import('@/features/purchasing/components/PurchaseReturnDrawer').then(m => ({ default: m.PurchaseReturnDrawer as unknown as AnyDrawerComponent }))),
  payment: React.lazy(() => import('@/features/treasury/components/PaymentDrawer').then(m => ({ default: m.PaymentDrawer as unknown as AnyDrawerComponent }))),
  journal_entry: React.lazy(() => import('@/features/accounting/components/JournalEntryDrawer').then(m => ({ default: m.JournalEntryDrawer as unknown as AnyDrawerComponent }))),
  cash_movement: React.lazy(() => import('@/features/treasury/components/CashMovementDrawer').then(m => ({ default: m.CashMovementDrawer as unknown as AnyDrawerComponent }))),
  terminal_batch: React.lazy(() => import('@/features/treasury/components/TerminalBatchDrawer').then(m => ({ default: m.TerminalBatchDrawer as unknown as AnyDrawerComponent }))),
  profit_distribution: React.lazy(() => import('@/features/settings/components/ProfitDistributionDrawer').then(m => ({ default: m.ProfitDistributionDrawer as unknown as AnyDrawerComponent }))),
  stock_move: React.lazy(() => import('@/features/inventory/components/StockMoveDrawer').then(m => ({ default: m.StockMoveDrawer as unknown as AnyDrawerComponent }))),
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
      <ErrorBoundary variant="inline">
        <Drawer open={open} onOpenChange={onOpenChange} {...props} />
      </ErrorBoundary>
    </Suspense>
  )
}
