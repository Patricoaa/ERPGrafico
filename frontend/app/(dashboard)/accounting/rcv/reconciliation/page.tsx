import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Ruta anterior del cuadre: los enlaces guardados siguen funcionando, con su query (`selected`, filtros). */
export default async function AccountingRcvReconciliationPage({ searchParams }: PageProps) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v)
  }
  const query = params.toString()
  redirect(query ? `/accounting/rcv/cuadre?${query}` : "/accounting/rcv/cuadre")
}
