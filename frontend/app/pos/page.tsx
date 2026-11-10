"use client"

import { OperatorGateProvider, POSProvider, POSClientView } from '@/features/pos'

export default function POSPage() {
    return (
        <POSProvider>
            <OperatorGateProvider>
                <POSClientView />
            </OperatorGateProvider>
        </POSProvider>
    )
}
