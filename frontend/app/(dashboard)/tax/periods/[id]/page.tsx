import { redirect } from 'next/navigation'

// T-100 (F9): AccountingPeriod fue eliminado del UniversalRegistry.
// Esta ruta ya no recibe deeplinks desde el Universal Search.
// Redirigir al módulo de impuestos como fallback seguro.
export default async function DetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
    redirect('/accounting/tax')
}
