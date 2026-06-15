import { redirect } from "next/navigation"

const HR_SETTINGS_TAB_MAP: Record<string, string> = {
    global: 'global',
    concepts: 'concepts',
    previsional: 'previsional',
}

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function HRPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    
    if (view === 'absences') redirect('/hr/absences')
    if (view === 'advances') redirect('/hr/advances')
    if (view === 'payrolls') redirect('/hr/payrolls')
    if (view === 'config') {
        redirect(tab && HR_SETTINGS_TAB_MAP[tab] ? `/hr/settings/${HR_SETTINGS_TAB_MAP[tab]}` : '/hr/settings/global')
    }

    redirect('/hr/employees')
}
