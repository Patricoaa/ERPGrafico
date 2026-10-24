import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string }>
}

/**
 * ADR-0090: el módulo Ventas abre en el tab Documentos (/sales/docs). Los `?view=` heredados se
 * mantienen solo para las secciones que siguen existiendo (POS, cartera, configuración);
 * los antiguos `view=orders` apuntan a la lista de órdenes bajo Documentos.
 */
export default async function SalesPage({ searchParams }: PageProps) {
    const { view, sub } = await searchParams

    if (view === 'orders') redirect('/sales/dtes/orders')
    if (view === 'dtes') redirect('/sales/dtes')
    if (view === 'pos') redirect(sub === 'sessions' ? '/sales/sessions' : '/sales/pos/cajas')
    if (view === 'hardware') redirect(sub ? `/treasury/terminal-cobro/${sub}` : '/treasury/terminal-cobro/providers')
    if (view === 'credits') redirect(sub ? `/sales/credits/${sub}` : '/sales/credits/portfolio')
    if (view === 'config') redirect('/sales/settings/credit')

    redirect('/sales/docs')
}
