import { PageSectionHeader } from "@/components/shared"
import SalesOrdersPageClient from "./SalesOrdersPageClient"

export default async function SalesOrdersPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Órdenes de Venta" description="Gestión de pedidos y cotizaciones de clientes" />
            <SalesOrdersPageClient />
        </>)
}
