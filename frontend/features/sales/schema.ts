import { z } from "zod"
import { editableSchema } from "@/components/entity-view"
import { deliveryLinesEditable, serviceDeliveryLinesEditable, type OrderLine } from "@/features/orders"

/** Dispatch form of `DeliveryDrawer`: header + line quantities in one resolver (invariant #9). */
export function deliveryFormSchema(isService: boolean, lines: readonly OrderLine[]) {
    return z.object({
        // Services leave from the first warehouse: no choice to validate.
        warehouseId: isService ? z.number().nullable() : z.number({ message: "Seleccione una bodega" }),
        deliveryDate: z.string().min(1, "La fecha de despacho es obligatoria"),
        lines: editableSchema(isService ? serviceDeliveryLinesEditable : deliveryLinesEditable, lines),
    })
}

export type DeliveryFormValues = z.infer<ReturnType<typeof deliveryFormSchema>>
