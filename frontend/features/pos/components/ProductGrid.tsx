"use client"

// @deprecated — migrado a @/components/shared/ProductSelector
// Mantener este re-export para no romper imports existentes dentro del feature POS.
// Los consumidores fuera del POS deben importar desde '@/components/shared'.

export { ProductGrid } from '@/components/shared/ProductSelector'
export type { ProductGridProps } from '@/components/shared/ProductSelector'
