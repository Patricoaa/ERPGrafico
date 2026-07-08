import { redirect } from "next/navigation"

const BILLING_SETTINGS_TAB_MAP: Record<string, string> = {
    dtes: 'dtes',
}

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function BillingPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    
    if (view === 'purchases') redirect('/billing/purchases')
    if (view === 'config') {
        redirect(tab && BILLING_SETTINGS_TAB_MAP[tab] ? `/billing/settings/${BILLING_SETTINGS_TAB_MAP[tab]}` : '/billing/settings/dtes')
    }

    redirect('/billing/sales')
}
