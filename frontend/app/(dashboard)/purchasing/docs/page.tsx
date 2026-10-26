import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>
}

/**
 * Deeplink canónico para el grupo Documentos de Compras (/purchasing/docs).
 * Redirige por defecto a la lista de Órdenes de Compra (/purchasing/dtes/orders),
 * preservando cualquier parámetro de consulta (ej. ?view=card).
 */
export default async function PurchasingDocsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, value)
    }
    const queryString = query.toString()
    redirect(`/purchasing/dtes/orders${queryString ? `?${queryString}` : ""}`)
}
