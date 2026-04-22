export interface PartnerSummary {
    total_partners: number;
    total_contributions: string;
    total_withdrawals: string;
    net_equity: string;
    total_net_equity?: string;
}

export interface Partner {
    id: number;
    name: string;
    tax_id: string;
    partner_equity_percentage: string;
    partner_total_contributions: string;
    partner_total_paid_in: string;
    partner_pending_capital: string;
    partner_excess_capital: string;
    partner_provisional_withdrawals_balance: string;
    partner_earnings_balance: string;
    partner_dividends_payable_balance: string;
    partner_net_equity: string;
    partner_account_id?: number | null;
}

export interface PartnerStatement {
    contact: {
        id: number;
        name: string;
        tax_id: string;
    };
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
    transaction_type_display: string;
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

export interface ProfitDistributionLine {
    id: number;
    partner: number;
    partner_name: string;
    destination?: 'DIVIDEND' | 'REINVEST' | 'RETAINED';
    net_amount: string;
    gross_amount: string;
    provisional_withdrawals_offset: string;
    percentage_at_date: string;
    paid_dividend_amount?: string;
    unpaid_dividend_amount?: string;
    destinations?: {
        id: number;
        destination: 'DIVIDEND' | 'REINVEST' | 'RETAINED';
        amount: string;
    }[];
}

export interface ProfitDistribution {
    id: number;
    display_id: string;
    fiscal_year: number;
    net_result: string;
    resolution_date: string;
    acta_number?: string;
    status: 'DRAFT' | 'APPROVED' | 'EXECUTED' | 'CANCELLED';
    lines?: ProfitDistributionLine[];
    is_profit?: boolean;
    is_loss?: boolean;
    fiscal_year_obj?: number;
    total_paid_dividend_amount?: string;
    total_unpaid_dividend_amount?: string;
    notes?: string;
}

export interface PartnerTransactionPayload {
    transaction_type: 'CAPITAL_CASH' | 'CAPITAL_INVENTORY' | 'SUBSCRIPTION' | 'REDUCTION' | 'TRANSFER' | 'PROV_WITHDRAWAL' | 'DIVIDEND_PAYMENT' | 'REINVESTMENT' | 'LOSS_ABSORPTION' | 'WITHDRAWAL' | 'LOAN_IN' | 'LOAN_OUT';
    amount: string | number;
    date: string;
    description: string;
    treasury_account_id?: number | null;
}
