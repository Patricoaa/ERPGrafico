import { createEntityFields } from "@/components/shared"
import type { LedgerMovement } from "./types"
import { formatPlainDate } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const ledgerMovementFields = createEntityFields<LedgerMovement>()({
    date: {
        key: "date",
        type: "computed",
        label: "Fecha",
        placement: "detail",
        render: (m) => (
            <div className="flex justify-center items-center w-full text-center text-sm font-sans font-medium text-foreground whitespace-nowrap">
                {formatPlainDate(m.date)}
                {m.created_at && (
                    <span className="text-xs text-muted-foreground/60 ml-1.5">
                        {new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        ),
    },
    description: {
        key: "description",
        type: "computed",
        label: "Descripción",
        placement: "detail",
        render: (m) => {
            const glosa = m.label || m.description
            return (
                <div className="flex justify-center w-full">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="max-w-[400px] text-xs leading-relaxed text-center">
                                {glosa}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">{glosa}</TooltipContent>
                    </Tooltip>
                </div>
            )
        },
    },
    debit: {
        key: "debit",
        type: "currency",
        label: "Debe",
        placement: "detail",
        showZeroAsDash: true,
    },
    credit: {
        key: "credit",
        type: "currency",
        label: "Haber",
        placement: "detail",
        showZeroAsDash: true,
    },
    balance: {
        key: "balance",
        type: "currency",
        label: "Saldo",
        placement: "detail",
        cellProps: { showColor: true },
    },
})
