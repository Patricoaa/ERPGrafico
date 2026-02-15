export interface Account {
    id: number
    code: string
    name: string
    account_type: string
    account_type_display: string
    parent: number | null
    debit_total: string
    credit_total: string
    balance: string
    is_selectable: boolean
}

export interface AccountFilters {
    code?: string
    name?: string
    account_type?: string
}

export interface AccountPayload {
    code: string
    name: string
    account_type: string
    parent?: number | null
    is_selectable?: boolean
}
