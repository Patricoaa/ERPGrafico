import { PageSectionHeader } from "@/components/shared"
import SalesOrdersPageClient from "./SalesOrdersPageClient"

export default async function SalesOrdersPage() {
    return (
        <>
            <PageSectionHeader title="Órdenes de Venta" description="Gestión de pedidos y cotizaciones de clientes" />
            <SalesOrdersPageClient />
        </>)
}
