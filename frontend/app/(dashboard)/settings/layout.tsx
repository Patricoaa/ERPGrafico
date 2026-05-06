import { Metadata } from "next"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { SettingsHeader } from "./SettingsHeader"

export const metadata: Metadata = {
    title: "Configuración Global | ERPGrafico",
    description: "Panel de administración y parámetros transversales del sistema.",
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <SettingsHeader />
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
