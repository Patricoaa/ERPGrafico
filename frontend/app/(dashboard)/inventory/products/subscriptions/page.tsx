import { redirect } from "next/navigation"

// Las suscripciones viven ahora en el módulo de Compras (/purchasing/subscriptions).
// Se conserva esta ruta como redirector de compatibilidad.
export default function ProductsSubscriptionsPage() {
    redirect("/purchasing/subscriptions")
}
