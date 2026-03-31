import { Metadata } from "next"
import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/ui/LoadingFallback"

const ContactsClientView = lazy(() =>
    import("@/features/contacts").then(m => ({ default: m.ContactsClientView }))
)

export const metadata: Metadata = {
    title: "Contactos | ERPGrafico",
    description: "Directorio centralizado de clientes, proveedores y colaboradores.",
}

export default function ContactsPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ContactsClientView />
        </Suspense>
    )
}

