import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function BillingPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    
    // Redirect logic to preserve backward compatibility for bookmarked URLs
    if (view === 'purchases') redirect('/billing/purchases')
    if (view === 'config') {
        if (tab) {
            redirect(`/billing/settings?tab=${tab}`)
        }
        redirect('/billing/settings')
    }

    // Default redirect
    redirect('/billing/sales')
}
