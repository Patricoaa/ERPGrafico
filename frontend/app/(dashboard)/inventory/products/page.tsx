import type { Metadata } from "next"
import { ProductClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import { DEFAULT_PRODUCT_LIST_QUERY, type InitialProductPage } from "@/features/inventory"
import { getInventoryProductsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryProductsSubTab("products")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Catálogo de Productos | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string; search?: string; product_type?: string; category?: string; has_variants?: string; availability?: string }>
}

// group_by too: grouping loads a different (bounded) page, so a prefetch would be wasted.
const FILTER_PARAMS = new Set(['search', 'product_type', 'category', 'has_variants', 'availability', 'is_active', 'group_by'])

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { modal } = params

  // Only pre-fetch when there are no active search/filter params; otherwise
  // the unfiltered server data would be immediately discarded by the client.
  const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
  // Same query as the client's default (first page, templates only, server order): the client
  // only reuses it for that exact query (ProductClientView), so it must match it.
  let initialPage: InitialProductPage | undefined
  if (!hasActiveFilters) {
    try {
      const data = await serverFetch<InitialProductPage>('inventory/products/', {
        params: {
          page_size: String(DEFAULT_PRODUCT_LIST_QUERY.page_size),
          parent_template__isnull: String(DEFAULT_PRODUCT_LIST_QUERY.parent_template__isnull),
        },
        revalidate: 10,
      })
      initialPage = data
    } catch {
      // Client-side fetch handles fallback
    }
  }

  const createAction = <ToolbarCreateButton key="create-product" label="Nuevo Producto" href="/inventory/products?modal=new" />

  return (
    <>
      <ProductClientView
        initialPage={initialPage}
        externalOpen={modal === 'new'}
        createAction={createAction}
      />
    </>
  )
}