import { createEntityFields } from "@/components/shared"
import type { Budget } from "./api/financeApi"

export const budgetFields = createEntityFields<Budget>()({
    name: { key: "name", type: "text", label: "Presupuesto" },
    period: { 
        key: "start_date", 
        type: "text", 
        label: "Periodo",
        get: (e: Budget) => `${e.start_date} - ${e.end_date}`,
        cardPlacement: "body"
    },
    description: { 
        key: "description", 
        type: "text", 
        label: "Descripción",
        cardPlacement: "body"
    }
})
