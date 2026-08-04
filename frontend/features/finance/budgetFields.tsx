import { createEntityFields } from "@/components/shared"
import { Calendar, Wallet } from "lucide-react"
import Link from "next/link"
import type { Budget } from "./api/financeApi"

export const budgetFields = createEntityFields<Budget>()({
    name: {
        key: "name",
        type: "computed",
        label: "Nombre",
        render: (e) => (
            <div className="flex flex-col items-center justify-center w-full">
                <Link
                    href={`/finances/budgets/${e.id}`}
                    className="font-medium hover:underline text-primary flex items-center gap-2"
                >
                    <Wallet className="h-4 w-4" />
                    {e.name}
                </Link>
                {e.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {e.description}
                    </span>
                )}
            </div>
        ),
    },
    period: {
        key: "start_date",
        type: "secondary",
        label: "Periodo",
        icon: Calendar,
        get: (e) => `${e.start_date} - ${e.end_date}`,
    },
})
