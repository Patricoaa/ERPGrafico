import type { FilterState } from '@/components/shared'
import type { PosDraftFilters } from '../types/index'

export const POS_KEYS = {
  // Drafts
  drafts: {
    all: ['posDrafts'] as const,
    lists: () => [...POS_KEYS.drafts.all, 'list'] as const,
    list: (filters?: PosDraftFilters) => [...POS_KEYS.drafts.lists(), { filters }] as const,
    detail: (): readonly ['posDrafts', 'detail'] => [...POS_KEYS.drafts.all, 'detail'] as const,
    detailById: (id: number) => [...POS_KEYS.drafts.detail(), id] as const,
  },

  // POS Sessions
  sessions: {
    all: ['posSessions'] as const,
    lists: () => [...POS_KEYS.sessions.all, 'list'] as const,
    list: (filters?: FilterState) => [...POS_KEYS.sessions.lists(), { filters }] as const,
    detail: () => [...POS_KEYS.sessions.all, 'detail'] as const,
    detailById: (id: number) => [...POS_KEYS.sessions.detail(), id] as const,
    summary: () => [...POS_KEYS.sessions.all, 'summary'] as const,
    summaryById: (id: number) => [...POS_KEYS.sessions.summary(), id] as const,
  },

  // Terminals
  terminals: {
    all: ['posTerminals'] as const,
    list: () => [...POS_KEYS.terminals.all, 'list'] as const,
  },

  // Treasury Accounts
  treasuryAccounts: {
    all: ['treasuryAccounts'] as const,
    list: () => [...POS_KEYS.treasuryAccounts.all, 'list'] as const,
    detail: () => [...POS_KEYS.treasuryAccounts.all, 'detail'] as const,
    detailById: (id: number) => [...POS_KEYS.treasuryAccounts.detail(), id] as const,
  },

  // Accounting Settings
  accountingSettings: {
    all: ['accountingSettings'] as const,
    detail: () => [...POS_KEYS.accountingSettings.all, 'detail'] as const,
  },

  // UoMs
  uoms: {
    all: ['uoms'] as const,
    list: (params?: Record<string, unknown>) => [...POS_KEYS.uoms.all, 'list', { params }] as const,
  },

  // Effective Sale Price (likely a computation, not a list)
  effectiveSalePrice: {
    all: ['effectiveSalePrice'] as const,
    byParams: (params?: Record<string, unknown>) => [...POS_KEYS.effectiveSalePrice.all, 'byParams', { params }] as const,
  },

  // Products (from inventory)
  products: {
    all: ['products'] as const,
    lists: () => [...POS_KEYS.products.all, 'list'] as const,
    list: (filters?: { active?: boolean; can_be_sold?: boolean }) => [...POS_KEYS.products.lists(), { filters }] as const,
    details: () => [...POS_KEYS.products.all, 'detail'] as const,
    detail: (id: number) => [...POS_KEYS.products.details(), id] as const,
  },

  // Categories (from inventory)
  categories: {
    all: ['categories'] as const,
    list: () => [...POS_KEYS.categories.all, 'list'] as const,
  },

  // Product Variants (from inventory)
  variants: {
    all: ['variants'] as const,
    list: (productId?: number) => [...POS_KEYS.variants.all, 'list', { productId }] as const,
  }
}