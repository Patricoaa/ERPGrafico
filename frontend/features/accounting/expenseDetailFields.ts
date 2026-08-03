import { createEntityFields } from "@/components/shared"

export interface ExpenseDetail {
    id: number
    code: string
    description: string
    date: string
    total: string | number
    contact_display_name: string
    cost_center_name: string
    accounting_account_name: string
    contact_name?: string
    accounting_account_code?: string
}

export const expenseDetailFields = createEntityFields<ExpenseDetail>()({
    code: {
        key: "code",
        type: "code",
        label: "Folio",
    },
    description: {
        key: "description",
        type: "text",
        label: "Descripción",
    },
    date: {
        key: "date",
        type: "date",
        label: "Fecha",
    },
    totalWithTax: {
        key: "total",
        type: "currency",
        label: "Total",
        intent: "success",
    },
    contactDisplayName: {
        key: "contact_display_name",
        type: "text",
        label: "Contacto",
    },
    costCenterName: {
        key: "cost_center_name",
        type: "text",
        label: "Centro de Costo",
    },
    accountingAccountName: {
        key: "accounting_account_code",
        type: "code",
        label: "Cuenta Contable",
    },
})
