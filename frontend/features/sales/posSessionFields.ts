import { createEntityFields } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import type { POSSession } from "./components/POSSessionsClientView"

export const posSessionFields = createEntityFields<POSSession>()({
    id: {
        key: "id",
        type: "code",
        label: "ID",
        get: (s) => formatEntityDisplay("pos.session", s as unknown as Record<string, unknown>),
    },
    userName: {
        key: "user_name",
        type: "text",
        label: "Usuario",
    },
    terminal: {
        key: "terminal_name",
        type: "text",
        label: "Punto de venta",
    },
    openedAt: {
        key: "opened_at",
        type: "dateTime",
        label: "Apertura",
    },
    closedAt: {
        key: "closed_at",
        type: "dateTime",
        label: "Cierre",
    },
    totalSales: {
        key: "total_sales",
        type: "currency",
        label: "Ventas",
        get: (s) => (s.total_cash_sales ?? 0) + (s.total_card_sales ?? 0),
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
        get: (s) => s.status,
        getLabel: (s) => s.status_display,
    },
})
