"use client"

import { ProductGrid } from '@/components/shared/ProductSelector/ProductGrid'
import { SkeletonShell } from '@/components/shared/SkeletonShell'
import { useDeviceContext } from '@/hooks/useDeviceContext'

export function ProductGridSkeleton() {
  const { isTouchPOS, isSmallScreen } = useDeviceContext()

  const gridCols = isTouchPOS
      ? "grid-cols-3"
      : isSmallScreen
          ? "grid-cols-2"
          : "grid-cols-2 lg:grid-cols-4"

  // Create 12 placeholder products with minimal shape to avoid errors
  const placeholderProducts = Array.from({ length: 12 }, () => ({
    id: 0,
    name: '',
    category: 0,
    product_type: '',
    image: null,
    sale_price: 0,
    qty_available: 0,
    is_dynamic_pricing: false,
    requires_advanced_manufacturing: false,
    mfg_auto_finalize: false,
    has_bom: false,
    manufacturable_quantity: 0,
    is_favorite: false,
    // Add any other fields that are accessed in ProductGrid rendering
  }))

  return (
    <SkeletonShell isLoading ariaLabel="Cargando productos">
      <ProductGrid
        products={placeholderProducts}
        categories={[]}
        limits={{}}
        isProductDisabled={() => false}
        onProductClick={() => {}}
        onToggleFavorite={() => {}}
        priceRenderer={() => null}
      />
    </SkeletonShell>
  )
}