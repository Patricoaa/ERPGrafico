import { createEntityFields } from "@/components/shared"
import type { POSSession } from "./components/POSSessionsClientView"

export const posSessionFields = createEntityFields<POSSession>()({
    id: {
        key: "id",
        type: "code",
        label: "ID",
        get: (s) => `SES-${s.id}`,
    },
    userName: {
        key: "user_name",
        type: "text",
        label: "Cajero",
    },
    treasuryAccountName: {
        key: "treasury_account_name",
        type: "text",
        label: "Cuenta",
        cardPlacement: "detail",
    },
    openedAt: {
        key: "opened_at",
        type: "date",
        label: "Apertura",
        cellProps: { showTime: true },
    },
    closedAt: {
        key: "closed_at",
        type: "date",
        label: "Cierre",
        cellProps: { showTime: true },
    },
    startAmount: {
        key: "start_amount",
        type: "secondary",
        label: "Fondo Inicial",
        cardPlacement: "detail",
    },
    totalSales: {
        key: "total_sales",
        type: "currency",
        label: "Ventas",
        cardPlacement: "metric",
        get: (s) => (s.total_cash_sales ?? 0) + (s.total_card_sales ?? 0),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        get: (s) => s.status,
    },
})
