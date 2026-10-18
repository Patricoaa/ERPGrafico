import { SubscriptionsClientView } from "@/features/purchasing"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function PurchasingSubscriptionsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Suscripción" href="/purchasing/subscriptions?modal=new" />

    return (
        <>
            <SubscriptionsClientView
                hideHeader
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
