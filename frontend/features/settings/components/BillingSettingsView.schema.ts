import * as z from "zod"

export const billingSchema = z.object({
    allowed_dte_types_emit: z.array(z.string()),
    allowed_dte_types_receive: z.array(z.string()),
})

export type BillingFormValues = z.infer<typeof billingSchema>
