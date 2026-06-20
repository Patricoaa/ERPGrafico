import { SubscriptionsClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsSubscriptionsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Suscripción" href="/inventory/products/subscriptions?modal=new" />

    return (
        <SubscriptionsClientView
            hideHeader
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
