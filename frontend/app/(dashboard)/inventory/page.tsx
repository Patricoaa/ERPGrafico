import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string }>
}

export default async function InventoryPage({ searchParams }: PageProps) {
    const { view, sub } = await searchParams

    if (view === 'stock') redirect(sub ? `/inventory/stock/${sub}` : '/inventory/stock')
    if (view === 'uoms') redirect(sub ? `/inventory/uoms/${sub}` : '/inventory/uoms')
    if (view === 'attributes') redirect('/inventory/attributes')
    if (view === 'config') redirect('/inventory/settings')
    if (view === 'products') redirect(sub ? `/inventory/products/${sub}` : '/inventory/products')

    redirect('/inventory/products')
}
