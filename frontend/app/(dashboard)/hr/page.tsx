import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function HRPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams
    
    // Redirect logic to preserve backward compatibility for bookmarked URLs
    if (view === 'absences') redirect('/hr/absences')
    if (view === 'advances') redirect('/hr/advances')
    if (view === 'payrolls') redirect('/hr/payrolls')
    if (view === 'config') {
        if (tab) {
            redirect(`/hr/settings?tab=${tab}`)
        }
        redirect('/hr/settings')
    }

    // Default redirect
    redirect('/hr/employees')
}
