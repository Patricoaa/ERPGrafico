import { EmptyState } from "@/components/shared"
import { Settings } from "lucide-react"

export default function ContactsSettingsPage() {
    return (
        <div className="pt-8">
            <EmptyState
                icon={Settings}
                title="Configuración de Contactos"
                description="Próximamente: Categorías, orígenes de prospectos y campos personalizados."
                variant="full"
                context="generic"
            />
        </div>
    )
}
