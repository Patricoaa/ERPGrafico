"use client"

import { POSProvider, POSClientView } from '@/features/pos'

export default function POSPage() {
    return (
        <POSProvider>
            <POSClientView />
        </POSProvider>
    )
}
