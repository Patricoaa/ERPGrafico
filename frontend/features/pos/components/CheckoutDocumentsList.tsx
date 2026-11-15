import { formatCurrency } from "@/lib/money"
import type { CheckoutDocument } from "@/features/sales"

interface CheckoutDocumentsListProps {
    documents?: CheckoutDocument[]
}

/** Lista los documentos emitidos por un cobro dividido (pago mixto). Con 0 o 1 no muestra nada. */
export function CheckoutDocumentsList({ documents }: CheckoutDocumentsListProps) {
    if (!documents || documents.length < 2) return null
    return (
        <section aria-label="Documentos emitidos" className="mb-4 space-y-1 rounded-sm border border-border p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Documentos emitidos</p>
            <ul className="space-y-1">
                {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{doc.display_id}</span>
                        <span className="font-mono tabular-nums">{formatCurrency(Number(doc.total))}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
