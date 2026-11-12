import type { PartnerStatement, PartnerTransaction } from "@/features/contacts"
import { parseDateOnly } from "@/lib/utils"

/** Movimientos del statement que cumplen `belongs`, del más reciente al más antiguo. */
export function movementsOf(statement: PartnerStatement | undefined, belongs: (type: string) => boolean): PartnerTransaction[] {
    return (statement?.transactions ?? [])
        .filter(tx => belongs(tx.transaction_type))
        .sort((a, b) => {
            const d = parseDateOnly(b.date).getTime() - parseDateOnly(a.date).getTime()
            return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
}
