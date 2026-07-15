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
        type: "currency",
        label: "Fondo Inicial",
        cellProps: { intent: "muted" },
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        get: (s) => s.status,
    },
})
