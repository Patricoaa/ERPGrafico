import { createEntityFields } from '@/components/shared'
import { DocumentRefLink } from '@/features/documents'

type ReceiptLine = Record<string, unknown>

/**
 * Líneas de una recepción en su ficha documental (ADR-0083, invariante 13): producto (enlace),
 * cantidad y movimiento de stock (enlace). `placement: 'detail'` mantiene el orden definido.
 */
export const purchaseReceiptLineFields = createEntityFields<ReceiptLine>()({
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
        key: 'quantity_received',
        placement: 'detail',
        type: 'number',
        label: 'Cantidad',
        suffix: (l) => String(l.uom_name ?? ''),
        tableOptions: { align: 'right' },
    },
    stock_move: {
        key: 'stock_move',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Movimiento',
        tableOptions: { align: 'left' },
        render: (l) => l.stock_move
            ? <DocumentRefLink documentRef={l.stock_move_document} />
            : <span className="text-xs text-muted-foreground">—</span>,
    },
})
