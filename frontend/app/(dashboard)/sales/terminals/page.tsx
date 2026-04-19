import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"
import { Store, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"

// Lazy load the heavy SalesTerminalsView component
const SalesTerminalsView = lazy(() => import("@/features/sales/components/SalesTerminalsView"))

interface PageProps {
    searchParams: Promise<{ 
        tab?: string,
        modal?: string
    }>
}

export default async function TerminalsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "terminals"
    const modal = params.modal

    const tabs = [
        { value: "terminals", label: "Terminales POS", iconName: "banknote", href: "/sales/terminals?tab=terminals" },
        { value: "batches", label: "Lotes de Liquidación", iconName: "receipt", href: "/sales/terminals?tab=batches" },
        { value: "sessions", label: "Historial de Sesiones", iconName: "list", href: "/sales/terminals?tab=sessions" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "terminals":
                return {
                    title: "Terminales POS",
                    description: "Administre los puntos de venta y sus métodos de pago autorizados.",
                    iconName: "banknote",
                    actions: (
                        <Link href="/sales/terminals?tab=terminals&modal=new-terminal">
                            <PageHeaderButton iconName="plus" circular title="Nuevo Terminal" />
                        </Link>
                    )
                }
            case "batches":
                return {
                    title: "Lotes de Liquidación",
                    description: "Registre liquidaciones y comisiones de terminales de cobro.",
                    iconName: "receipt",
                    actions: (
                        <div className="flex items-center gap-2">
                            <Link href="/sales/terminals?tab=batches&modal=new-batch">
                                <PageHeaderButton iconName="plus" circular title="Registrar Liquidación" />
                            </Link>
                        </div>
                    ),
                    children: (
                        <Link href="/sales/terminals?tab=batches&modal=new-invoice">
                            <Button variant="outline" size="sm" className="h-9">
                                <Receipt className="mr-2 h-4 w-4" /> Factura Mensual
                            </Button>
                        </Link>
                    )
                }
            case "sessions":
                return {
                    title: "Historial de Sesiones",
                    description: "Registro cronológico de aperturas y cierres de terminales POS.",
                    iconName: "list",
                    actions: null,
                    children: (
                        <a href="/pos" target="_blank" rel="noopener noreferrer">
                            <Button className="bg-primary hover:bg-primary/90 h-9">
                                <Store className="mr-2 h-4 w-4" />
                                Ir al POS
                            </Button>
                        </a>
                    )
                }
            default:
                return { title: "Terminales", description: "", iconName: "banknote", actions: null }
        }
    }

    const { title, description, iconName, actions, children } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

            <PageHeader
                title={title}
                description={description}
                iconName={iconName}
                titleActions={actions}
            >
                {children}
            </PageHeader>
            
            <div className="pt-4">
                <Suspense fallback={<LoadingFallback message="Cargando terminales..." />}>
                    <SalesTerminalsView 
                        activeTab={activeTab} 
                        modal={modal}
                    />
                </Suspense>
            </div>
        </div>
    )
}
