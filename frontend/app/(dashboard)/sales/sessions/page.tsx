"use client"

import { POSSessionsView } from "@/features/sales/components/POSSessionsView"

export default function POSSessionsPage({ hideHeader = false }: { hideHeader?: boolean }) {
    return <POSSessionsView hideHeader={hideHeader} />
}
