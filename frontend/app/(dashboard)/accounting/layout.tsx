import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { AccountingHeader } from "./AccountingHeader"

export const metadata: Metadata = {
    title: "Contabilidad | ERPGrafico",
    description: "Gestión centralizada del plan de cuentas, asientos, periodos y cumplimiento tributario.",
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <AccountingHeader />
            <div className="pt-2 flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
