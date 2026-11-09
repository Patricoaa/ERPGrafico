import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// treasury.possession → abre como drawer en /sales/sessions a través de ENTITY_DRAWERS.
// La URL canónica (/treasury/sessions/{id}) redirige a la lista; openEntity() abre el drawer.
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['treasury.possession']
    redirect(`${listUrl}?selected=${id}`)
}
