import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function PurchasingPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    
    // Redirect logic to preserve backward compatibility for bookmarked URLs
    if (view === 'notes') redirect('/purchasing/notes')

    // Default redirect
    redirect('/purchasing/orders')
}
