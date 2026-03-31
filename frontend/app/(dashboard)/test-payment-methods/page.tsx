"use client"

import { useAllowedPaymentMethods } from "@/hooks/useAllowedPaymentMethods"

export default function TestPaymentMethods() {
    const { methods: salesMethods, loading: salesLoading, error: salesError } = useAllowedPaymentMethods({
        operation: 'sales',
        enabled: true
    })

    const { methods: purchaseMethods, loading: purchaseLoading, error: purchaseError } = useAllowedPaymentMethods({
        operation: 'purchases',
        enabled: true
    })

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-2xl font-bold">Debug Payment Methods</h1>

            <div className="grid grid-cols-2 gap-8">
                <div className="border p-4 rounded">
                    <h2 className="text-xl font-bold mb-4">Sales Methods</h2>
                    {salesLoading && <p>Loading...</p>}
                    {salesError && <p className="text-destructive">{salesError}</p>}
                    <pre className="text-xs bg-secondary text-secondary-foreground p-2 rounded overflow-auto h-96">
                        {JSON.stringify(salesMethods, null, 2)}
                    </pre>
                </div>

                <div className="border p-4 rounded">
                    <h2 className="text-xl font-bold mb-4">Purchase Methods</h2>
                    {purchaseLoading && <p>Loading...</p>}
                    {purchaseError && <p className="text-destructive">{purchaseError}</p>}
                    <pre className="text-xs bg-secondary text-secondary-foreground p-2 rounded overflow-auto h-96">
                        {JSON.stringify(purchaseMethods, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    )
}
