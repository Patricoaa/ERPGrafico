import { SubscriptionList } from "@/components/inventory/SubscriptionList"

export default function SubscriptionsPage() {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Suscripciones</h2>
                    <p className="text-muted-foreground">
                        Gestione sus servicios recurrentes y suscripciones activas.
                    </p>
                </div>
            </div>
            <SubscriptionList />
        </div>
    )
}
