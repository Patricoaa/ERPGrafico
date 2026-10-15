import { createEntityFields } from '@/components/shared'
import { DocumentRefLink } from '@/features/documents'

type DistributionLine = Record<string, unknown>

const DESTINATION: Record<string, string> = { DIVIDEND: 'Dividendo', REINVEST: 'Reinversión', RETAINED: 'Retenida' }

/** Socios de una distribución de resultados en su ficha documental (ADR-0083, invariante 13). */
export const profitDistributionLineFields = createEntityFields<DistributionLine>()({
    partner: {
        key: 'partner_name',
        placement: 'detail',
        type: 'computed',
        fieldRole: 'descriptive',
        label: 'Socio',
        tableOptions: { align: 'left' },
        render: (l) => l.partner
            ? <DocumentRefLink label="contacts.contact" id={Number(l.partner)} display={String(l.partner_name ?? '-')} mono={false} />
            : <span className="text-xs">{String(l.partner_name ?? '-')}</span>,
    },
    percentage: {
        key: 'percentage_at_date',
        placement: 'detail',
        type: 'number',
        label: 'Participación',
        suffix: '%',
        tableOptions: { align: 'right' },
    },
    destination: {
        key: 'destination',
        placement: 'detail',
        type: 'text',
        label: 'Destino',
        get: (l) => DESTINATION[String(l.destination)] ?? '—',
        tableOptions: { align: 'left' },
    },
    offset: {
        key: 'provisional_withdrawals_offset',
        placement: 'detail',
        type: 'currency',
        label: 'Retiros a compensar',
        tableOptions: { align: 'right' },
    },
    net_amount: {
        key: 'net_amount',
        placement: 'detail',
        type: 'currency',
        label: 'Monto neto',
        tableOptions: { align: 'right' },
    },
})
