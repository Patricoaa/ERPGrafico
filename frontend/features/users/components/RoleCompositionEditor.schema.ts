import * as z from 'zod'

export const compositionSchema = z.object({
    bundles: z.array(z.string()),
    extra_permissions: z.array(z.string()),
    excluded_permissions: z.array(z.string()),
})

export type CompositionFormValues = z.infer<typeof compositionSchema>
