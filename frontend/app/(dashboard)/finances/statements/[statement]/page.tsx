import { notFound } from "next/navigation"
import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

const STATEMENTS = {
    bs: {
        title: "Balance General",
        description: "Situación patrimonial y financiera del período",
    },
    pl: {
        title: "Estado de Resultados",
        description: "Ingresos, costos y resultados del período",
    },
    cf: {
        title: "Flujo de Caja",
        description: "Movimientos de efectivo del período",
    },
} as const

type StatementKey = keyof typeof STATEMENTS

export function generateStaticParams() {
    return Object.keys(STATEMENTS).map((statement) => ({ statement }))
}

interface PageProps {
    params: Promise<{ statement: string }>
}

export default async function StatementPage({ params }: PageProps) {
    const { statement } = await params
    const config = STATEMENTS[statement as StatementKey]
    if (!config) notFound()

    return (
        <>
            <PageSectionHeader as="h1" title={config.title} description={config.description} />
            <FinancialStatementsReport activeTab={statement} />
        </>
    )
}