import { redirect } from "next/navigation"

const ACCOUNTING_SETTINGS_TAB_MAP: Record<string, string> = {
    structure: 'structure',
    defaults: 'defaults',
    tax: 'tax',
}

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function AccountingPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams

    if (view === 'ledger') redirect('/accounting/ledger')
    if (view === 'entries') redirect('/accounting/entries')
    if (view === 'closures') redirect('/accounting/closures')
    if (view === 'tax') redirect('/accounting/tax')
    if (view === 'config') {
        redirect(tab && ACCOUNTING_SETTINGS_TAB_MAP[tab] ? `/accounting/settings/${ACCOUNTING_SETTINGS_TAB_MAP[tab]}` : '/accounting/settings/structure')
    }

    redirect('/accounting/ledger')
}
