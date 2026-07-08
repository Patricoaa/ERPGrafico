import { redirect } from 'next/navigation'

export default async function TaxPage() {
    redirect('/accounting/closures')
}
