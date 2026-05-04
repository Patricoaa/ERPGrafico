import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"
import { Store, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"

const SalesTerminalsView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesTerminalsView })))

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

    const navigation = {
        tabs,
        activeValue: activeTab
    }

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "terminals":
                return {
                    title: "Terminales POS",
                    description: "Administre los puntos de venta y sus métodos de pago autorizados.",
                    iconName: "banknote",
                    createLabel: "Nuevo Terminal",
                    createHref: "/sales/terminals?tab=terminals&modal=new-terminal",
                    children: null as React.ReactNode
                }
            case "batches":
                return {
                    title: "Lotes de Liquidación",
                    description: "Registre liquidaciones y comisiones de terminales de cobro.",
                    iconName: "receipt",
                    createLabel: "Registrar Liquidación",
                    createHref: "/sales/terminals?tab=batches&modal=new-batch",
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
                    createLabel: null,
                    createHref: null,
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
                return { title: "Terminales", description: "", iconName: "banknote", createLabel: null, createHref: null, children: null as React.ReactNode }
        }
    }

    const { title, description, iconName, createLabel, createHref, children } = getHeaderConfig()

    const createAction = createLabel && createHref ? (
        <ToolbarCreateButton label={createLabel} href={createHref} />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                iconName={iconName}
                variant="minimal"
                navigation={navigation}
            >
                {children}
            </PageHeader>

            <div className="pt-4">
                <Suspense fallback={<LoadingFallback message="Cargando terminales..." />}>
                    <SalesTerminalsView
                        activeTab={activeTab}
                        modal={modal}
                        createAction={createAction}
                    />
                </Suspense>
            </div>
        </div>
    )
}
