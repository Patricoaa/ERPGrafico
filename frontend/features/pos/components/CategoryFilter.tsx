"use client"

// @deprecated — migrado a @/components/shared/ProductSelector
// Mantener este re-export para no romper imports existentes dentro del feature POS.
// Los consumidores fuera del POS deben importar desde '@/components/shared'.
//
// Nota: CategoryFilterProps usa ProductCategory (de @/features/inventory/types)
// en lugar del tipo Category (de @/types/pos). Son estructuralmente idénticos.

export { CategoryFilter } from '@/components/shared'
export type { CategoryFilterProps } from '@/components/shared'
