import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { AccountingHeader } from "./AccountingHeader"

export const metadata: Metadata = {
    title: "Contabilidad | ERPGrafico",
    description: "Gestión centralizada del plan de cuentas, asientos, periodos y cumplimiento tributario.",
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <AccountingHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
