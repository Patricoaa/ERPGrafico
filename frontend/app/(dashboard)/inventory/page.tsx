import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string }>
}

export default async function InventoryPage({ searchParams }: PageProps) {
    const { view, sub } = await searchParams

    // Redirect logic for backward compatibility with old ?view= params
    if (view === 'stock') redirect(sub ? `/inventory/stock?tab=${sub}` : '/inventory/stock')
    if (view === 'uoms') redirect(sub ? `/inventory/uoms?tab=${sub}` : '/inventory/uoms')
    if (view === 'attributes') redirect('/inventory/attributes')
    if (view === 'config') redirect('/inventory/settings')
    if (view === 'products') redirect(sub ? `/inventory/products?tab=${sub}` : '/inventory/products')

    // Default redirect
    redirect('/inventory/products')
}
