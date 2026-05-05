import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function ProductionPage({ searchParams }: PageProps) {
    const { view } = await searchParams
    
    // Redirect logic to preserve backward compatibility for bookmarked URLs
    if (view === 'boms') redirect('/production/boms')
    if (view === 'config') redirect('/production/settings')

    // Default redirect
    redirect('/production/orders')
}
