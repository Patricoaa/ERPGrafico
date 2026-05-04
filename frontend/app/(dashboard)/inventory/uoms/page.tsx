import { Tabs } from "@/components/ui/tabs"
import { UoMsView } from "@/features/inventory"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface PageProps {
    searchParams: Promise<{ tab?: string }>
}

export default async function UnifiedUoMPage({ searchParams }: PageProps) {
    const { tab } = await searchParams
    const activeTab = tab || "units"

    const tabs = [
        { value: "units", label: "Unidades", iconName: "scale", href: "/inventory/uoms?tab=units" },
        { value: "categories", label: "Categorías", iconName: "layers", href: "/inventory/uoms?tab=categories" },
    ]

    const navigation = {
        tabs,
        activeValue: activeTab
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Unidades de Medida"
                description="Gestión de unidades físicas, conversiones y redondeo."
                variant="minimal"
                iconName="scale"
                navigation={navigation}
            />
            <Tabs value={activeTab} className="space-y-4 pt-4">
                <UoMsView activeTab={activeTab} />
            </Tabs>
        </div>
    )
}
