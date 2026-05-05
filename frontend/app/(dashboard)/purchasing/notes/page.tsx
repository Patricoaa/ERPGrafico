import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const PurchasingOrdersClientView = lazy(() =>
    import("../orders/components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

export default function PurchaseNotesPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <PurchasingOrdersClientView viewMode="notes" />
        </Suspense>
    )
}
