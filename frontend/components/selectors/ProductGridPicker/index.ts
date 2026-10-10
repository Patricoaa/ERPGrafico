// ProductGridPicker — public barrel
// Import from '@/components/selectors/ProductGridPicker' or from the shared
// getter below. Original name: components/shared/ProductSelector (audit T5);
// the grid was relocated here and the single-value picker in
// `components/selectors/ProductSelector.tsx` is now the only surface called
// `ProductSelector` (eng review 2026-09-16).

export { SearchBar } from './SearchBar'
export type { SearchBarProps } from './SearchBar'

export { CategoryFilter } from './CategoryFilter'
export type { CategoryFilterProps } from './CategoryFilter'

export { ProductGrid } from './ProductGrid'
export type { ProductGridProps, SharedStockLimits } from './ProductGrid'

export { VariantSelectorModal } from './VariantSelectorModal'
export type { VariantSelectorModalProps } from './VariantSelectorModal'

export { ProductGridPicker } from './ProductGridPicker'
export type { ProductGridPickerProps } from './ProductGridPicker'

export { CategoryDropdown } from './CategoryDropdown'