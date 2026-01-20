export interface HistoricalRecord {
    history_id: number;
    history_date: string;
    history_change_reason: string | null;
    history_type: '+' | '~' | '-';
    history_user_id: number | null;
    history_user_username: string;
    [key: string]: any;
}

export interface ActionLog {
    id: number;
    user: number | null;
    user_name: string;
    timestamp: string;
    action_type: string;
    action_type_display: string;
    description: string;
    ip_address: string | null;
    metadata: Record<string, any>;
}
