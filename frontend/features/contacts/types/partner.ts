export interface PartnerSummary {
    total_partners: number;
    total_contributions: string;
    total_withdrawals: string;
    net_equity: string;
}

export interface PartnerStatement {
    contact: any; // Using existing contact type structurally
    summary: {
        equity_percentage: string;
        balance: string;
    };
    transactions: PartnerTransaction[];
}

export interface PartnerTransaction {
    id: number;
    partner: number;
    partner_name: string;
    transaction_type: string;
    amount: string;
    date: string;
    description: string;
    journal_entry_id: number;
    journal_entry_display: string;
    treasury_movement?: number;
    created_by: number;
    created_by_name: string;
    created_at: string;
}

export interface PartnerTransactionPayload {
    transaction_type: 'CAPITAL_CASH' | 'CAPITAL_INVENTORY' | 'WITHDRAWAL' | 'LOAN_IN' | 'LOAN_OUT';
    amount: string;
    date: string;
    description: string;
    treasury_account_id?: number | null;
}
