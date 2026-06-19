import * as z from "zod"

export const partnerAccountsSchema = z.object({
    partner_capital_social_account: z.string().nullable(),
    partner_capital_contribution_account: z.string().nullable(),
    partner_withdrawal_account: z.string().nullable(),
    partner_provisional_withdrawal_account: z.string().nullable(),
    partner_capital_receivable_account: z.string().nullable(),
    partner_retained_earnings_account: z.string().nullable(),
    partner_current_year_earnings_account: z.string().nullable(),
    partner_dividends_payable_account: z.string().nullable(),
})

export type PartnerAccountsFormValues = z.infer<typeof partnerAccountsSchema>
