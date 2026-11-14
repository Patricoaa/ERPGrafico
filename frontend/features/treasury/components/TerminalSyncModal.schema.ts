import * as z from "zod"
import { format } from "date-fns"
import type { ManualSyncPayload } from "../types"

/** Today as local `YYYY-MM-DD` (ISO strings compare lexicographically). Evaluated on each validation. */
const todayIso = () => format(new Date(), "yyyy-MM-dd")

/** Manual TUU sync range. Both dates optional: empty means the backend default (history start / lookback). */
export const terminalSyncSchema = z
    .object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
    })
    .superRefine((values, ctx) => {
        if (values.end_date && values.end_date > todayIso()) {
            ctx.addIssue({ code: "custom", path: ["end_date"], message: "La fecha final no puede ser futura" })
        }
        if (values.start_date && values.end_date && values.start_date > values.end_date) {
            ctx.addIssue({ code: "custom", path: ["start_date"], message: "La fecha inicial debe ser anterior a la final" })
        }
    })

export type TerminalSyncFormValues = z.infer<typeof terminalSyncSchema>

/** Form values → API payload, omitting empty dates. */
export function toManualSyncPayload(values: TerminalSyncFormValues): ManualSyncPayload {
    const payload: ManualSyncPayload = {}
    if (values.start_date) payload.start_date = values.start_date
    if (values.end_date) payload.end_date = values.end_date
    return payload
}
