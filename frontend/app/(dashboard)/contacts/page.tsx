import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { Contact } from "@/features/contacts"
import ContactsPageClient from "./ContactsPageClient"

const FILTER_PARAMS = new Set(['search', 'type', 'tax_id', 'is_default_customer', 'is_default_vendor'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function ContactsPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialContacts: Contact[] | undefined
    if (!hasActiveFilters) {
        try {
            initialContacts = await serverFetch<Contact[]>('contacts/', {
                params: {
                    page_size: '200',
                },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Contactos" description="Gestión de clientes, proveedores y terceros" />
            <ContactsPageClient initialContacts={initialContacts} />
        </>)
}
