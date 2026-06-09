import type {
    TreasuryMovement,
    UpcomingInstallment,
    UnbilledItemRow,
} from '../types'

export function mapToUnbilledItemRows(
    charges: TreasuryMovement[],
    installments: UpcomingInstallment[],
): UnbilledItemRow[] {
    const chargeRows: UnbilledItemRow[] = charges.map(c => ({
        id: `charge-${c.id}`,
        source: 'charge' as const,
        date: c.date,
        reference: c.reference,
        notes: c.notes,
        amount: c.amount,
        installmentNumber: c.installment_number ?? null,
        totalInstallments: c.card_purchase_group_detail?.installments ?? null,
        purchaseGroupDetail: c.card_purchase_group_detail ?? null,
        partnerName: c.card_purchase_group_detail?.partner_name ?? null,
        movementType: c.movement_type,
        movementTypeDisplay: c.movement_type_display,
        isInstallmentInterest: c.is_installment_interest ?? false,
        originalCharge: c,
        originalInstallment: null,
    }))

    const installmentRows: UnbilledItemRow[] = installments.map(i => ({
        id: `installment-${i.id}`,
        source: 'installment' as const,
        date: i.due_date,
        reference: i.group_display_id,
        notes: i.partner_name,
        amount: Number(i.principal_amount),
        installmentNumber: i.number,
        totalInstallments: i.total_installments,
        purchaseGroupDetail: null,
        partnerName: i.partner_name,
        movementType: 'SCHEDULED',
        movementTypeDisplay: 'Cuota programada',
        isInstallmentInterest: false,
        originalCharge: null,
        originalInstallment: i,
    }))

    return [...chargeRows, ...installmentRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
}
