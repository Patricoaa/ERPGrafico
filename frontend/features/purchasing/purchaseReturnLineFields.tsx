import { createEntityFields } from '@/components/shared'
import { DocumentRefLink } from '@/features/documents'

type ReturnLine = Record<string, unknown>

/** Líneas de una devolución de compra en su ficha documental (ADR-0083, invariante 13). */
export const purchaseReturnLineFields = createEntityFields<ReturnLine>()({
    product: {
        key: 'product_name',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Producto',
        tableOptions: { align: 'left' },
        render: (l) => l.product
            ? <DocumentRefLink label="inventory.product" id={Number(l.product)} display={String(l.product_name ?? '-')} mono={false} />
            : <span className="text-xs">{String(l.product_name ?? '-')}</span>,
    },
    quantity: {
        key: 'quantity_returned',
        placement: 'detail',
        type: 'number',
        label: 'Cantidad devuelta',
        suffix: (l) => String(l.uom_name ?? ''),
        tableOptions: { align: 'right' },
    },
})
