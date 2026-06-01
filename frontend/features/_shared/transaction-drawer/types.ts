import type { DrawerMode } from "@/features/_shared/drawer/types"

export type TransactionDrawerMode = DrawerMode

export interface TransactionDrawerProps {
  id: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: TransactionDrawerMode
  onSuccess?: () => void
}

export const TYPE_TO_REGISTRY: Record<string, string> = {
  sale_order: 'sales.saleorder',
  purchase_order: 'purchasing.purchaseorder',
  invoice: 'billing.invoice',
  work_order: 'production.workorder',
  sale_delivery: 'sales.saledelivery',
  purchase_receipt: 'purchasing.purchasereceipt',
  purchase_return: 'purchasing.purchasereturn',
  payment: 'finance.payment',
  journal_entry: 'accounting.journalentry',
  cash_movement: 'treasury.treasurymovement',
  terminal_batch: 'treasury.terminalbatch',
  profit_distribution: 'contacts.profitdistributionresolution',
  stock_move: 'inventory.stockmove',
  inventory: 'inventory.stockmove',
}

export type TransactionType = keyof typeof TYPE_TO_REGISTRY
