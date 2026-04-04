"use client"

import { use, lazy, Suspense, useState } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { Tabs } from "@/components/ui/tabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Plus } from "lucide-react"
import { LAYOUT_TOKENS } from "@/lib/styles"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default function SalesOrdersPage({ searchParams }: PageProps) {
    const params = use(searchParams)
    const viewMode = (params.view as 'orders' | 'notes') || 'notes'
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const tabs = [
        { value: "orders", label: "Notas de Venta", iconName: "shopping-cart", href: "/sales/orders?view=orders" },
        { value: "notes", label: "Notas Crédito/Débito", iconName: "file-text", href: "/sales/orders?view=notes" },
    ]

    const headerConfigs = {
        orders: {
            title: "Notas de Venta",
            description: "Seguimiento de pedidos, estados de fabricación y logística de entregas.",
            iconName: "shopping-cart",
            showAction: false
        },
        notes: {
            title: "Notas de Crédito y Débito",
            description: "Gestión de devoluciones, correcciones de facturación y ajustes de cuenta.",
            iconName: "file-text",
            showAction: false // Hidden by default unless manual entry is needed
        }
    }

    const currentHeader = headerConfigs[viewMode]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={currentHeader.title}
                description={currentHeader.description}
                iconName={currentHeader.iconName}
                variant="minimal"
                titleActions={currentHeader.showAction ? (
                    <PageHeaderButton
                        onClick={() => setIsCreateModalOpen(true)}
                        icon={Plus}
                        circular
                        className="bg-primary text-primary-foreground"
                    />
                ) : null}
            />

            <Tabs value={viewMode} className="w-full space-y-0">
                <div className="-mx-8">
                    <PageTabs tabs={tabs} activeValue={viewMode} />
                </div>
                
                <Suspense fallback={<LoadingFallback />}>
                    <SalesOrdersClientView 
                        viewMode={viewMode} 
                        isCreateModalOpen={isCreateModalOpen}
                        setCreateModalOpen={setIsCreateModalOpen}
                    />
                </Suspense>
            </Tabs>
        </div>
    )
}
