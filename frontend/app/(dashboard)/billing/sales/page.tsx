"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { SalesInvoicesClientView } from "@/features/billing"

export default function SalesInvoicesPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const { openHub, isHubOpen } = useHubPanel()
    const [hubEverOpened, setHubEverOpened] = useState(false)

    const selectedId = searchParams.get('selected')

    // 1. Open Hub panel if ?selected= is present
    useEffect(() => {
        if (selectedId) {
            openHub({ invoiceId: Number(selectedId), orderId: null, type: 'sale' })
        }
    }, [selectedId, openHub])

    // 2. Track when hub opens
    useEffect(() => {
        if (isHubOpen && selectedId) setHubEverOpened(true)
    }, [isHubOpen, selectedId])

    // 3. Clean URL when hub closes
    useEffect(() => {
        if (hubEverOpened && !isHubOpen && selectedId) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('selected')
            const query = params.toString()
            setHubEverOpened(false)
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, hubEverOpened, selectedId, pathname, searchParams, router])

    return (
        <SalesInvoicesClientView />
    )
}
