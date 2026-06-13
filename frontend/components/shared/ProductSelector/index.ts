// ProductSelector — Public barrel
// Import from '@/components/shared' (re-exported below) or directly from
// '@/components/shared/ProductSelector' for finer-grained imports.
//
// PR-1: SearchBar + CategoryFilter
// PR-2: ProductGrid
// PR-3: VariantSelectorModal + ProductSelector (orchestrator)

export { SearchBar } from './SearchBar'
export type { SearchBarProps } from './SearchBar'

export { CategoryFilter } from './CategoryFilter'
export type { CategoryFilterProps } from './CategoryFilter'

export { ProductGrid } from './ProductGrid'
export type { ProductGridProps, SharedStockLimits } from './ProductGrid'

export { VariantSelectorModal } from './VariantSelectorModal'
export type { VariantSelectorModalProps } from './VariantSelectorModal'

export { ProductSelector } from './ProductSelector'
export type { ProductSelectorProps } from './ProductSelector'

export { CategoryDropdown } from './CategoryDropdown'
