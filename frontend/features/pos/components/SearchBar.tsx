"use client"

// @deprecated — migrado a @/components/shared/ProductSelector
// Mantener este re-export para no romper imports existentes dentro del feature POS.
// Los consumidores fuera del POS deben importar desde '@/components/shared'.

export { SearchBar } from '@/components/shared/ProductSelector'
export type { SearchBarProps } from '@/components/shared/ProductSelector'
