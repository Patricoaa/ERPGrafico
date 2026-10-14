import { DocumentResolverView } from '@/features/documents'

// ADR-0080: resolvedor genérico de documentos por tipo (label app.model) + id.
export default async function DocumentResolverPage({ params }: { params: Promise<{ label: string; id: string }> }) {
    const { label, id } = await params
    return <DocumentResolverView label={decodeURIComponent(label)} id={Number(id)} />
}
