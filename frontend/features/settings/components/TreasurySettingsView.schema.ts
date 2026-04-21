import * as z from "zod"

export const treasurySchema = z.object({
    // Reconciliation accounts
    bank_commission_account: z.string().nullable(),
    interest_income_account: z.string().nullable(),
    exchange_difference_account: z.string().nullable(),
    rounding_adjustment_account: z.string().nullable(),
    error_adjustment_account: z.string().nullable(),
    miscellaneous_adjustment_account: z.string().nullable(),
    // POS Session Difference accounts
    pos_cash_difference_gain_account: z.string().nullable(),
    pos_cash_difference_loss_account: z.string().nullable(),
    // POS Manual Movement (adjustment) accounts
    pos_tip_account: z.string().nullable(),
    pos_other_inflow_account: z.string().nullable(),
    pos_counting_error_account: z.string().nullable(),
    pos_system_error_account: z.string().nullable(),
    pos_partner_withdrawal_account: z.string().nullable(),
    pos_theft_account: z.string().nullable(),
    pos_rounding_adjustment_account: z.string().nullable(),
    pos_cashback_error_account: z.string().nullable(),
    pos_other_outflow_account: z.string().nullable(),
})

export type TreasuryFormValues = z.infer<typeof treasurySchema>
