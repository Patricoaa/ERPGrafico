import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

/**
 * ADR-0090: el módulo Compras abre en el tab Documentos. Los estados de tab
 * heredados (`?view=`) se resuelven a la sección correspondiente; las notas
 * NC/ND ya no tienen lista propia (viven dentro de DTE y como acción de la factura).
 */
export default async function PurchasingPage({ searchParams }: PageProps) {
    const { view } = await searchParams

    if (view === 'orders') redirect('/purchasing/dtes/orders')
    if (view === 'dtes') redirect('/purchasing/dtes')
    if (view === 'notes') redirect('/purchasing/dtes')
    if (view === 'config') redirect('/purchasing/settings/dtes')

    redirect('/purchasing/docs')
}
