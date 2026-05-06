import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { TreasuryHeader } from "./TreasuryHeader"

export const metadata: Metadata = {
    title: "Módulo de Tesorería | ERPGrafico",
    description: "Gestión centralizada de cuentas, movimientos y conciliación bancaria.",
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <TreasuryHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
