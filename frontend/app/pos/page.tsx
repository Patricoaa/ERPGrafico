"use client"

import { POSProvider } from '@/features/pos/contexts/POSContext'
import { POSClientView } from '@/features/pos/components/POSClientView'

export default function POSPage() {
    return (
        <POSProvider>
            <POSClientView />
        </POSProvider>
    )
}
