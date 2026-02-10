import { AttributeManager } from "@/components/inventory/AttributeManager"
import { PageHeader } from "@/components/shared/PageHeader"

export const metadata = {
    title: "Atributos de Variantes - ERPGrafico",
}

export default function AttributesPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Atributos de Variantes"
                description="Gestiona los atributos y valores para productos con variaciones."
            />
            <AttributeManager />
        </div>
    )
}
