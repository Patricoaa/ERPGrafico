import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function PurchasingPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    
    // Redirect logic to preserve backward compatibility for bookmarked URLs
    if (view === 'notes') redirect('/purchasing/notes')
    if (view === 'config') redirect('/purchasing/settings')

    // Default redirect
    redirect('/purchasing/orders')
}
