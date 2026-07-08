import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): ProductCategory → /inventory/products/categories?selected=<id>
// CategoryList está montada en /inventory/products/categories. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['inventory.productcategory']
    redirect(`${listUrl}&selected=${id}`)
}
