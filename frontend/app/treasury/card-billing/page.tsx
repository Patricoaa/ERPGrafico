import CardBillingDashboard from "@/components/treasury/CardBillingDashboard"
import { CreditCard } from "lucide-react"

export default function CardBillingPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-500/20">
                        <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Facturación de Tarjetas</h2>
                        <p className="text-muted-foreground text-sm">Controle las comisiones retenidas y genere las facturas mensuales de proveedores.</p>
                    </div>
                </div>
            </div>

            <CardBillingDashboard />
        </div>
    )
}
