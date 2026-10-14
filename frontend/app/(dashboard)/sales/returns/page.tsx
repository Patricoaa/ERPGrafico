import type { Metadata } from "next"
import ReturnsPageClient from "./ReturnsPageClient"

export const metadata: Metadata = {
    title: "Devoluciones | ERPGrafico",
}

export default function SalesReturnsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <ReturnsPageClient />
        </div>)
}
