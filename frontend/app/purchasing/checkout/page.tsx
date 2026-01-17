"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PurchaseCheckoutWizard } from "@/components/purchasing/PurchaseCheckoutWizard"
import api from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

function CheckoutContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const orderId = searchParams.get('orderId')

    const [loading, setLoading] = useState(!!orderId)
    const [order, setOrder] = useState<any>(null)
    const [orderLines, setOrderLines] = useState<any[]>([])
    const [total, setTotal] = useState(0)

    useEffect(() => {
        if (orderId) {
            const fetchOrder = async () => {
                try {
                    const response = await api.get(`/purchasing/orders/${orderId}/`)
                    const data = response.data

                    setOrder(data)
                    // Transform lines to match wizard format
                    const mappedLines = (data.lines || []).map((l: any) => ({
                        id: l.id,
                        product: l.product,
                        product_name: l.product_name,
                        qty: l.quantity,
                        quantity: l.quantity,
                        unit_cost: l.unit_cost,
                        uom: l.uom,
                        uom_name: l.uom_name,
                        tax_rate: l.tax_rate || 19
                    }))

                    setOrderLines(mappedLines)
                    setTotal(parseFloat(data.total))
                } catch (error) {
                    console.error("Error fetching order:", error)
                    toast.error("No se pudo cargar la orden")
                    router.push('/purchasing/orders')
                } finally {
                    setLoading(false)
                }
            }
            fetchOrder()
        } else {
            // New order - initialize with empty line
            setOrderLines([{ product: "", quantity: 1, uom: "", unit_cost: 0, tax_rate: 19 }])
            setTotal(0)
        }
    }, [orderId, router])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Cargando orden...</span>
            </div>
        )
    }

    return (
        <PurchaseCheckoutWizard
            open={true}
            onOpenChange={(open) => {
                if (!open) router.push('/purchasing/orders')
            }}
            order={order}
            orderLines={orderLines}
            total={total}
            onComplete={() => {
                router.push('/purchasing/orders')
            }}
            initialSupplierId={order?.supplier?.toString()}
            initialWarehouseId={order?.warehouse?.toString()}
        />
    )
}

export default function PurchasingCheckoutPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    )
}
