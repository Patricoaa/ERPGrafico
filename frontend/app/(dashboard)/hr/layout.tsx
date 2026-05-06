import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { HRHeader } from "./HRHeader"

export const metadata: Metadata = {
    title: "Módulo de Recursos Humanos (RRHH) | ERPGrafico",
    description: "Gestión centralizada de personal, inasistencias, anticipos y liquidaciones.",
}

export default function HRLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <HRHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
