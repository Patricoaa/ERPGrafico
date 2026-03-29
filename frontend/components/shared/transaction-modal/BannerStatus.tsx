import { Badge } from "@/components/ui/badge"
import { translateStatus } from "@/lib/utils"

export const BannerStatus = ({ status, type }: { status: string, type: string }) => {
    // Payment-specific status handling
    if (type === 'payment' || type === 'cash_movement') {
        const variant = status === 'RECONCILED' || status === 'POSTED' ? 'default' :
            status === 'PENDING' ? 'secondary' : 'outline'
        return (
            <Badge variant={variant} className="font-bold text-xs px-3 py-1 uppercase tracking-wider">
                {translateStatus(status)}
            </Badge>
        )
    }

    // General status handling
    const variant = status === 'DELIVERED' || status === 'PAID' || status === 'COMPLETED' || status === 'RECEIVED' ? 'default' :
        status === 'PARTIAL' || status === 'READY' || status === 'APPROVED' ? 'secondary' : 'outline'

    return (
        <Badge variant={variant} className="font-bold text-xs px-3 py-1 uppercase tracking-wider">
            {translateStatus(status)}
        </Badge>
    )
}
