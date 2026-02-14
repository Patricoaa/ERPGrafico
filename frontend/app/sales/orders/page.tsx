import { Metadata } from "next"
import { SalesOrdersClientView } from "@/components/sales/SalesOrdersClientView"

export const metadata: Metadata = {
    title: "Notas de Venta | ERPGrafico",
    description: "Gestión de pedidos, facturación y estados de entrega.",
}

export default function SalesOrdersPage() {
    return <SalesOrdersClientView />
}
