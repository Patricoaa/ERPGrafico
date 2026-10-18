import { z } from "zod"
import { editableSchema } from "@/components/entity-view"
import { receiptLinesEditable, returnLinesEditable, type OrderLine } from "@/features/orders"

/** Receipt (or return) form of `ReceiptModal`: header + line quantities and costs in one resolver (invariant #9). */
export function receiptFormSchema(isRefund: boolean, lines: readonly OrderLine[]) {
    return z.object({
        warehouseId: z.number({ message: "Seleccione una bodega" }),
        receiptDate: z.string().min(1, "La fecha es obligatoria"),
        deliveryReference: z.string(),
        notes: z.string(),
        lines: editableSchema(isRefund ? returnLinesEditable : receiptLinesEditable, lines),
    })
}

export type ReceiptFormValues = z.infer<ReturnType<typeof receiptFormSchema>>
