import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const PurchasingOrdersClientView = lazy(() =>
    import("../orders/components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

export default function PurchaseNotesPage() {
    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<LoadingFallback />}>
                <PurchasingOrdersClientView viewMode="notes" />
            </Suspense>
        </div>
    )
}
