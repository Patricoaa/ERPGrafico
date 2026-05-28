'use client'

import React, { Suspense } from 'react'
import { SkeletonShell } from '@/components/shared'
import type { TransactionDrawerProps, TransactionType } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drawerMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  sale_order: React.lazy(() =>
    import('@/features/sales/components/SaleOrderDrawer').then(m => ({ default: m.SaleOrderDrawer as React.FC<TransactionDrawerProps> })),
  ),
  purchase_order: React.lazy(() =>
    import('@/features/purchasing/components/PurchaseOrderDrawer').then(m => ({ default: m.PurchaseOrderDrawer as React.FC<TransactionDrawerProps> })),
  ),
  invoice: React.lazy(() =>
    import('@/features/billing/components/InvoiceDrawer').then(m => ({ default: m.InvoiceDrawer as React.FC<TransactionDrawerProps> })),
  ),
  work_order: React.lazy(() =>
    import('@/features/production').then(m => ({
      default: function WorkOrderAdapter(props: TransactionDrawerProps) {
        return React.createElement(m.WorkOrderWizard, {
          mode: { kind: 'manage' as const, orderId: props.id!, },
          open: props.open,
          onOpenChange: props.onOpenChange,
        })
      },
    })),
  ),
  sale_delivery: React.lazy(() =>
    import('@/features/sales/components/SaleDeliveryDrawer').then(m => ({ default: m.SaleDeliveryDrawer as React.FC<TransactionDrawerProps> })),
  ),
  purchase_receipt: React.lazy(() =>
    import('@/features/purchasing/components/PurchaseReceiptDrawer').then(m => ({
      default: m.PurchaseReceiptDrawer as unknown as React.FC<TransactionDrawerProps>,
    })),
  ),
  purchase_return: React.lazy(() =>
    import('@/features/purchasing/components/PurchaseReturnDrawer').then(m => ({
      default: m.PurchaseReturnDrawer as unknown as React.FC<TransactionDrawerProps>,
    })),
  ),
  payment: React.lazy(() =>
    import('@/features/finance/components/PaymentDrawer').then(m => ({ default: m.PaymentDrawer as React.FC<TransactionDrawerProps> })),
  ),
  journal_entry: React.lazy(() =>
    import('@/features/accounting/components/JournalEntryDrawer').then(m => ({
      default: m.JournalEntryDrawer as React.FC<TransactionDrawerProps>,
    })),
  ),
  cash_movement: React.lazy(() =>
    import('@/features/treasury/components/CashMovementDrawer').then(m => ({
      default: m.CashMovementDrawer as React.FC<TransactionDrawerProps>,
    })),
  ),
  terminal_batch: React.lazy(() =>
    import('@/features/treasury/components/TerminalBatchDrawer').then(m => ({
      default: m.TerminalBatchDrawer as React.FC<TransactionDrawerProps>,
    })),
  ),
  profit_distribution: React.lazy(() =>
    import('@/features/settings/components/ProfitDistributionDrawer').then(m => ({
      default: m.ProfitDistributionDrawer as React.FC<TransactionDrawerProps>,
    })),
  ),
  stock_move: React.lazy(() =>
    import('@/features/inventory/components/StockMoveDrawer').then(m => ({ default: m.StockMoveDrawer as React.FC<TransactionDrawerProps> })),
  ),
}

interface TransactionDrawerRouterProps extends TransactionDrawerProps {
  type: TransactionType
}

export function TransactionDrawerRouter({ type, ...props }: TransactionDrawerRouterProps) {
  const DrawerComponent = drawerMap[type]
  if (!DrawerComponent) {
    console.warn(`No drawer registered for type: ${type}`)
    return null
  }
  return (
    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
      <DrawerComponent {...props} />
    </Suspense>
  )
}
